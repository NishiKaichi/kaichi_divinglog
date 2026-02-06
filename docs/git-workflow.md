# Git Workflow (Required)

## Rule
All changes must follow this sequence:

1. Create GitHub Issue
2. Create branch from `main`
3. Implement
4. Test
5. Commit and push
6. Open PR
7. Merge PR
8. Delete merged branch

## Branch naming
- `feat/issue-<number>-<short-name>`
- `fix/issue-<number>-<short-name>`
- `chore/issue-<number>-<short-name>`

Examples:
- `feat/issue-12-admin-oauth`
- `fix/issue-21-search-index-cast`

## Commit message format
- `<type>: <summary>`

Types:
- `feat`
- `fix`
- `chore`
- `docs`
- `refactor`
- `test`

Examples:
- `feat: scaffold frontend and api monorepo`
- `fix: cast contentType enum in search chunk insert`

## PR policy
- 1 issue = 1 PR
- include test results in PR body
- do not merge if CI is red
- prefer squash merge

## Pre-merge checklist
- [ ] linked issue exists
- [ ] tests passed locally
- [ ] CI passed
- [ ] migration impact checked
- [ ] secrets are not committed

