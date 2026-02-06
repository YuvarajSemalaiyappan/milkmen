# Project Rules

## Commit Rules
- Use simple, single-line commit messages
- Do not include Co-Authored-By in commits
- ALWAYS run `npm ci && npm run build:render` before every commit

## Pre-Commit Checklist
1. Run `npm ci && npm run build:render`
2. If build fails, fix the issue before committing
3. This catches deployment issues locally before they fail in production
