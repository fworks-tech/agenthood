(async () => {
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
    // skipped/neutral are not failures — they mean the check did not run or
    // produced no verdict. Only explicit failures and cancellations fail the PR.
    const failed = runs.some(r => ['failure', 'timed_out', 'action_required', 'cancelled'].includes(r.conclusion));
    const skipped = runs.filter(r => ['skipped', 'neutral'].includes(r.conclusion)).length;
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
  if (runs.length === 0) return; // nothing to summarize — no comment

  const body = buildVerdictBody(runs);
  await upsertComment(body);
})()
