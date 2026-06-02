#!/bin/bash

MILESTONE_TITLE="v1.1.0 - The Living Editor"
REPO="fworks-tech/agenthood"

echo "Creating Milestone: $MILESTONE_TITLE..."
# Create the milestone via the GitHub API
gh api repos/$REPO/milestones \
  -f title="$MILESTONE_TITLE" \
  -f state="open" \
  -f description="Bringing the Agenthood Society to life with passive observation and proactive interventions in the VS Code editor." > /dev/null 2>&1 || echo "Milestone might already exist."

echo "Finding recent VS Code issues and updating them..."
# Find all open issues that start with 'feat(vscode):'
ISSUE_IDS=$(gh issue list --repo $REPO --search "in:title feat(vscode):" --state open --json number --jq '.[].number')

for ID in $ISSUE_IDS; do
  echo "Updating Issue #$ID..."
  # Add the milestone and label
  gh issue edit $ID --repo $REPO --milestone "$MILESTONE_TITLE" --add-label "vscode-extension"
done

echo "Done! Check your repository: https://github.com/$REPO/milestones"
