# Project Management Workflow

Requirements are settled in a GitHub Issue, stage and time are tracked in a GitHub Project, code and verification results live in the PR.

## Principles

- A work item is one user-completable feature or flow, never a single screen.
- Discussion happens in chat, confirmed results go in the Issue, code and verification go in the PR.
- The Issue body always holds only the latest confirmed version. Never record change rationale or superseded options; the discussion history stays in the chat session archive.
- Section 1 is written by the user. Sections 2-6 are written by the agent, each when that stage is confirmed.
- Never start the next stage before the user confirms the current one. Write the confirmed result into the Issue, report the stage is closed, and stop.

## Editing the Issue body

`gh issue edit <n> --body` replaces the whole body of that same issue. There is no partial edit, so always read the current body first, swap only the section being confirmed, and write the rest back byte-identical:

```
gh issue view <n> --json body -q .body > /tmp/body.md
# edit only the one section in /tmp/body.md
gh issue edit <n> --body-file /tmp/body.md
```

The user edits the body directly to attach images, so a blind full-body write destroys their uploads.

## Images

Never attach or link an image. Write only the filename, and let the user upload it in the browser:

- Format: `{issue#}_{sequence}_{title}`, e.g. `12_01_folder-empty.png`
- Sequence is two digits, restarting per issue. Title is lowercase kebab-case.
- This applies to both the Issue and the PR.

## Issue types

The organization has issue types enabled. `gh` cannot set them, so create the issue with `gh issue create` and then set the type with the GraphQL `updateIssue` mutation (`issueTypeId`); type ids come from `gh api orgs/<org>/issue-types`.

Each type has a default set of stages. Skipping is the default, not a rule: the user can ask for a skipped stage in chat.

| Type | 2 Requirement | 3 Design | 4 Test Criteria | 5 Breakdown | 6 PR |
|---|---|---|---|---|---|
| Feature | yes | yes | yes | yes | yes |
| Bug | reproduction steps and expected behavior | skip | yes, including the regression | skip | yes |
| Refactor | scope and what must not change | skip | yes, proving existing behavior holds | yes | yes |

## Stages

Stage names match the Project `Status` field exactly: `Requirement`, `Design`, `Test Criteria`, `Breakdown`, `Implementation`, `PR`, `Complete`.

| Status | Issue section | Agent | User |
|---|---|---|---|
| `Requirement` | 2 | Drafts detailed requirements from the user's request and repo context | Reviews in chat, confirms the final version |
| `Design` | 3 | Presents candidates as artifacts, per `references/design-candidates.md` | Reviews in chat, picks and confirms one |
| `Test Criteria` | 4 | Drafts pass/fail conditions, per `references/test-criteria.md` | Reviews in chat, confirms the final version |
| `Breakdown` | 5 | Writes the implementation spec and flow from sections 2-4 | — |
| `Implementation` | — | Implements and tests against the confirmed criteria | Instructs the agent to start |
| `PR` | 6 | Opens the PR, records actual test results in it, applies feedback | Reviews the PR |
| `Complete` | — | — | Merges the PR |

### 1. Request

The user writes `1. 기능 또는 문제 [USER]` roughly and gives the Issue number in chat. When the discussion started in chat instead, the agent drafts section 1 and opens the Issue itself.

### 2. Requirement

Read the repo for context before drafting. Cover the user goal, the end-to-end flow, per-screen behavior, loading / empty / error states, and the platform scope (web wide / web mobile / iOS).

Check the server only when the requirement depends on server behavior, and record the finding in the `서버 API` line:

1. Check `https://dev.api.archivelink.app/openapi` first.
2. If the endpoint is not there, check `http://localhost:8080/openapi`; if local is not running, write `local shutdown` and judge on the dev server alone.
3. If neither responds, write `API 확인 불가` and tell the user it is theirs to check.

The spec is large (~400KB); never read it whole. Fetch it and grep for the paths and schema names the feature needs. State plainly which endpoints exist, which are missing, and what has to be stubbed. A requirement that depends on a missing endpoint must say so before the user confirms it.

### 3. Design

Present candidates as artifacts in chat, never in the Issue. Once one is picked, write only the confirmed design into section 3: behavior and screen transitions as text, plus one image filename per capture with the state it must show. The user uploads the images onto those lines, so never rewrite section 3 afterwards.

### 4. Test Criteria

Conditions the user can walk through by hand to judge whether the feature works and is finished, without reading code. Draft them, review them with the user in chat, then write the confirmed list into section 4 as checkboxes.

### 5. Breakdown

The implementation spec: screens and components to build, data / API / state handling, and how the work splits. Follow the repo conventions already stated in `AGENTS.md`; do not restate them here. Split into several PRs only when one flow is too large to land at once, and into a sub-issue when the server has to change — see `## Across repos`.

### Implementation

Implement in a git worktree of its own, never in the main checkout, so several sessions can work on different issues at once.

1. Run `git fetch origin`. Local `main` must not be behind `origin/main`: `git rev-list --count main..origin/main` is `0`. Local `main` being ahead is fine.
2. If it is behind, fast-forward it: `git fetch origin main:main`, or `git merge --ff-only origin/main` in the checkout where `main` is checked out. If that fails because `main` has diverged, stop and tell the user.
3. Create the worktree on a new branch for this issue from local `main`: `git worktree add -b <branch> <path> main`. When the session already runs in a worktree, check that its branch starts from that `main` instead of creating another one.

### 6. PR

The PR body carries the same checklist from section 4, with only the items actually verified checked off. When the work spans several PRs, every PR but the last links the Issue with `- Refs #n`, and the last one with `- Resolves #n`, so the Issue closes only when all of them land. Section 6 of the Issue records every PR link.

## Skipping sections

- Which stages a type skips by default is in the issue types table above.
- Confirm what to skip in chat. Mark a skipped section by keeping its heading and writing `(생략)`.
- `Requirement` (2) and `Test Criteria` (4) are never skipped.

## Across repos

The product is `QLink-Bookmarks/qlink-channel` (app) and `QLink-Bookmarks/qlink-backend` (server). The integrated requirement issue lives in `qlink-channel`, because the flow is judged on screen.

- Server work gets its own issue in `qlink-backend`, linked from the parent as a sub-issue at the `Breakdown` stage, once the split is known.
- The server issue owns its API contract. The parent links it and never copies it; read the contract there.
- A server sub-issue is always finished before its parent. So the parent's `Status` only ever follows its own stage and is never derived from its children.
- Server-only work with no user-visible flow — migrations, batch jobs, infrastructure, performance — is a standalone issue in `qlink-backend` with no parent.

## Project automation

One organization-level Project holds both repos; filter views by the built-in `Repository` field. Add issues only, not pull requests.

Three built-in workflows carry the stages that have a GitHub event behind them. All three fire on the issue item, so pull requests never need to be in the project:

- Item added to project → `Status: Requirement`
- Pull request linked to an issue → `Status: PR`
- Issue closed → `Status: Complete`

`- Resolves #n` in the PR body is what links the PR and later closes the issue. `- Refs #n` does neither, so a split Issue stays in `Implementation` until its last PR opens. The four stages in between — `Design`, `Test Criteria`, `Breakdown`, `Implementation` — have no event and are moved by hand as each one is confirmed.

A server sub-issue is created at `Breakdown` and moved straight to `Implementation`, since its requirement and design live in the parent.

## Resuming

The Issue body is the single source of truth for what is confirmed. Given only an Issue number, read the body, treat the last filled section as the completed stage, and ask the user to confirm the next one. Never re-open a stage the body already records as confirmed.
