.PHONY: setup docs docs-serve help

setup:
	@node dist/cli.js setup

docs:
	python -m mkdocs build --config-file docs/academy/mkdocs.yml

docs-serve:
	python -m mkdocs serve --config-file docs/academy/mkdocs.yml

help:
	@echo "make setup       — activate git hooks and commit template"
	@echo "make docs        — build Academy MkDocs site into site/"
	@echo "make docs-serve  — serve Academy docs locally with live reload"
