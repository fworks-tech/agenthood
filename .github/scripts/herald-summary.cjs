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
  // Escape markdown table metacharacters (| [ ] ` @) and collapse newlines so
  // workflow/check names cannot inject table cells, links, mentions, or emphasis
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`')
    .replace(/@/g, '\\@')
    .replace(/[\r\n]+/g, ' ');
}

async function paginate(fetchPage) {
  const items = [];
  let page = 1;
  for (;;) {
    const { data } = await fetchPage(page);
    const chunk = Array.isArray(data) ? data : data.workflow_runs;
    items.push(...chunk);
    const total = data.total_count;
    if (total !== undefined ? page * 100 >= total : chunk.length < 100) break;
    page++;
  }
  return items;
}

async function listWorkflowRunsForSha(github, owner, repo, sha) {
  const runs = await paginate((page) => github.rest.actions.listWorkflowRunsForRepo({
    owner, repo, head_sha: sha, per_page: 100, page,
  }));
  return runs.filter((run) => TRIGGER_WORKFLOWS.includes(run.name));
}

function verdictFor(hasFailed, skippedCount) {
  if (hasFailed) {
    return { verdict: 'Some trials failed. Review the details above.', summaryEmoji: ':x:' };
  }
  if (skippedCount > 0) {
    return { verdict: `All completed trials passed. ${skippedCount} check(s) were skipped or neutral.`, summaryEmoji: ':white_check_mark:' };
  }
  return { verdict: 'All trials passed. The PR is cleared for merge.', summaryEmoji: ':white_check_mark:' };
}

function buildVerdictBody(sha, prNumber, runs) {
  const shortSha = sha.slice(0, 7);
  const rows = runs.map((run) => {
    const icon = ICONS[run.conclusion] || ':grey_question:';
    return `| ${escapeCell(run.name)} | ${icon} ${run.conclusion} |`;
  }).join('\n');
  // skipped/neutral/stale are not failures — they mean the check did not run
  // or produced no verdict. Only explicit failures and cancellations fail.
  const hasFailed = runs.some((run) => FAILED_CONCLUSIONS.has(run.conclusion));
  const skippedCount = runs.filter((run) => SKIPPED_CONCLUSIONS.has(run.conclusion)).length;
  const { verdict, summaryEmoji } = verdictFor(hasFailed, skippedCount);
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

async function listComments(github, owner, repo, prNumber) {
  return paginate((page) => github.rest.issues.listComments({
    owner, repo, issue_number: prNumber, per_page: 100, page,
  }));
}

async function upsertComment(github, owner, repo, prNumber, body) {
  const comments = await listComments(github, owner, repo, prNumber);
  const existingComment = comments.find((c) => c.body.includes("The Herald's Verdict"));
  if (existingComment) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existingComment.id, body });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }
}

async function summarizePr(pr, github, owner, repo) {
  // only the triggering workflows' runs count as trials — unrelated checks
  // (labeler, dependabot, the Herald itself) never skew the verdict
  const trials = await listWorkflowRunsForSha(github, owner, repo, pr.head.sha);
  if (trials.length === 0) return;
  // wait until every triggering workflow has completed before posting
  if (!trials.every((run) => run.status === 'completed')) return;
  const body = buildVerdictBody(pr.head.sha, pr.number, trials);
  await upsertComment(github, owner, repo, pr.number, body);
}

async function summarize(context, github) {
  // workflow_run can carry several PRs sharing one head SHA — summarize all
  const prList = context.payload.workflow_run?.pull_requests || [];
  if (prList.length === 0) return;
  const { owner, repo } = context.repo;
  for (const pr of prList) {
    await summarizePr(pr, github, owner, repo);
  }
}

module.exports = { summarize, escapeCell, TRIGGER_WORKFLOWS };
