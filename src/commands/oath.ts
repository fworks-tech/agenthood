/**
 * agenthood oath
 *
 * Prints the Society's oath. Read it. Mean it.
 */

export async function oath(): Promise<void> {
  console.log(`
🏛️  The Oath of the Agenthood

  I commit with intention.
  I branch with purpose.
  I review with honesty.
  I ship with confidence.
  I never push to main.

─────────────────────────────────────────

What this means:

  I commit with intention.
    Every commit is a single, reversible, logical unit of change.
    It has a type. It has a scope. It has a subject that begins with a verb.
    It does not say "fix stuff", "wip", or "asdf".

  I branch with purpose.
    Every branch traces to an issue. Every issue traces to a goal.
    There are no mystery branches named "test2" or "my-changes".

  I review with honesty.
    Code review is not a formality. It is a conversation.
    Approval means the reviewer read it — not just clicked the button.

  I ship with confidence.
    Nothing merges without passing tests.
    Nothing deploys without a passing pipeline.

  I never push to main.
    Main is sacred. Main is production. Main is the truth.
    Direct pushes to main are not accidents. They are choices. Bad ones.

─────────────────────────────────────────

  The oath is not aspirational. It is operational.
  The Doorman enforces it. The Herald announces when you honored it.
`);
}
