const prList = context.payload.workflow_run?.pull_requests;
if (!prList || prList.length === 0) return;
const pr = prList[0];
const owner = context.repo.owner;
const repo = context.repo.repo;
const sha = pr.head.sha;
const prNumber = pr.number;

function buildVerdictBody(runs) {
  const iconMap = {
    success: ':white_check_mark:',
    failure: ':x:',
    timed_out: ':x:',
    cancelled: ':stop_button:',
    skipped: ':fast_forward:',
    neutral: ':speech_balloon:',
    action_required: ':warning:',
  };
  const shortSha = sha.slice(0, 7);
  const rows = runs.map(r => {
    const icon = iconMap[r.conclusion] || ':grey_question:';
    return `| ${r.name} | ${icon} ${r.conclusion} |`;
  }).join('\n');
  const passed = runs.every(r => r.conclusion === 'success');
  const verdict = passed
    ? 'All trials passed. The PR is cleared for merge.'
    : 'Some trials failed. Review the details above.';
  const summaryEmoji = passed ? ':white_check_mark:' : ':x:';
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

async function upsertComment(body) {
  const { data: comments } = await github.rest.issues.listComments({
    owner, repo, issue_number: prNumber,
  });
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

const { data: checkRuns } = await github.rest.checks.listForRef({
  owner, repo, ref: sha,
});

const runs = checkRuns.check_runs;
const completed = runs.every(r => r.status === 'completed');
if (!completed) return;

const body = buildVerdictBody(runs);
await upsertComment(body);
