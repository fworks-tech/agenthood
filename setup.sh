#!/bin/sh
# Agenthood — one-command setup
# Activates git hooks and commit template for this repository

set -e

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Agenthood — Activating Enforcement Layer                   │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

# Activate tracked hooks directory
git config core.hooksPath .githooks
echo "✓  git hooks path set to .githooks/"

# Make all hooks executable
chmod +x .githooks/*
echo "✓  hooks made executable"

# Set commit message template
git config commit.template conventions/.gitmessage
echo "✓  commit template set to conventions/.gitmessage"

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Active Hooks                                               │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│  commit-msg        The Doorman — commit message validation  │"
echo "│  pre-commit        The Doorman — block commits to main      │"
echo "│                    The Auditor — secret scanning            │"
echo "│                    The Warden  — file size warning          │"
echo "│  prepare-commit-msg            — template injection         │"
echo "│  pre-push          The Doorman — block push to main         │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│  Active CI Workflows                                        │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│  commitlint.yml    Validate commit messages on PR           │"
echo "│  pr-title.yml      Validate PR title format                 │"
echo "│  sentinel.yml      Validate member file structure           │"
echo "│  warden.yml        Enforce file size limits on PR           │"
echo "│  auditor.yml       Secret scanning via Gitleaks             │"
echo "│  tester.yml        Test suite (fails until tests exist)     │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "The Society is watching. Ship with confidence."
echo ""
