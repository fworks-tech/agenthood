.PHONY: setup help

setup:
	@node dist/cli.js setup

help:
	@echo "make setup       — activate git hooks and commit template"
