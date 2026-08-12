const TRIGGER_WORKFLOWS = [
  'Society — PR Standards',
  'The Envoy — VS Code Extension Build and Test',
  'The Reviewer — Commit Review',
];
// Single source of truth for conclusion classification — add a new conclusion
// here (e.g. 'stale'), not in the icon map or the filters.
const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'action_required', 'cancelled']);
const SKIPPED_CONCLUSIONS = new Set(['skipped', 'neutral', 'stale']);
const ICONS = {
  success: ':white_check_mark:',
  failure: ':x:',
  timed_out: ':x:',
  cancelled: ':stop_button:',
  skipped: ':fast_forward:',
  neutral: ':speech_balloon:',
  stale: ':recycle:',
  action_required: ':warning:',
};

function escapeCell(value) {
  // Escape markdown table metacharacters (| [ ] `) and collapse newlines so
  // workflow/check names cannot inject table cells, links, or @mentions
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`')
    .replace(/[\r\n]+/g, ' ');
}

async function listWorkflowRunsForSha(github, owner, repo, sha) {
  const trials = [];
  let page = 1;
  for (;;) {
    const { data } = await github.rest.actions.listWorkflowRunsForRepo({
      owner, repo, head_sha: sha, per_page: 100, page,
    });
    for (const run of data.workflow_runs) {
      if (TRIGGER_WORKFLOWS.includes(run.name)) trials.push(run);
    }
    if (page * 100 >= data.total_count || data.workflow_runs.length < 100) break;
    page++;
  }
  return trials;
}

async function summarize(context, github) {
  const prList = context.payload.workflow_run?.pull_requests || [];
  if (prList.length === 0) return;
  const { owner, repo } = context.repo;

  async function buildVerdictBody(sha, prNumber, runs) {
    const shortSha = sha.slice(0, 7);
    const rows = runs.map(r => {
      const icon = ICONS[r.conclusion] || ':grey_question:';
      return `| ${escapeCell(r.name)} | ${icon} ${r.conclusion} |`;
    }).join('\n');
    // skipped/neutral/stale are not failures — they mean the check did not run
    // or produced no verdict. Only explicit failures and cancellations fail.
    const failed = runs.some(r => FAILED_CONCLUSIONS.has(r.conclusion));
    const skipped = runs.filter(r => SKIPPED_CONCLUSIONS.has(r.conclusion)).length;
    let verdict;
    let summaryEmoji;
    if (failed) {
      verdict = 'Some trials failed. Review the details above.';
      summaryEmoji = ':x:';
    } else if (skipped > 0) {
      verdict = `All completed trials passed. ${skipped} check(s) were skipped or neutral.`;
      summaryEmoji = ':white_check_mark:';
    } else {
      verdict = 'All trials passed. The PR is cleared for merge.';
      summaryEmoji = ':white_check_mark:';
    }
    return [
      `## ${summaryEmoji} The Herald's Verdict`,
      '',
      `**PR #${prNumber}** · \`${shortSha}\``,
      '',
      runs.length > 1 ? `All ${runs.length} trials have concluded:` : 'The trial has concluded:',
      '',
      '| Check | Status |',
      '|-------|--------|',
      rows,
      '',
      `**${verdict}**`,
      '',
      '---',
      '<sub>The Herald — CI Summary</sub>',
    ].join('\n');
  }

  async function upsertComment(prNumber, body) {
    // paginate — a busy PR may have more than 100 comments
    const comments = [];
    let page = 1;
    for (;;) {
      const { data } = await github.rest.issues.listComments({
        owner, repo, issue_number: prNumber, per_page: 100, page,
      });
      comments.push(...data);
      if (data.length < 100) break;
      page++;
    }
    const existingComment = comments.find(c => c.body.includes("The Herald's Verdict"));
    if (existingComment) {
      await github.rest.issues.updateComment({
        owner, repo, comment_id: existingComment.id, body,
      });
    } else {
      await github.rest.issues.createComment({
        owner, repo, issue_number: prNumber, body,
      });
    }
  }

  // summarize every PR attached to the workflow run, not just the first
  for (const pr of prList) {
    const sha = pr.head.sha;
    const prNumber = pr.number;
    // only the triggering workflows' runs count as trials — unrelated checks
    // (labeler, dependabot, the Herald itself) never skew the verdict
    const trials = await listWorkflowRunsForSha(github, owner, repo, sha);
    if (trials.length === 0) continue;
    if (!trials.every(r => r.status === 'completed')) continue;
    const body = await buildVerdictBody(sha, prNumber, trials);
    await upsertComment(prNumber, body);
  }
}

module.exports = { summarize, escapeCell };
