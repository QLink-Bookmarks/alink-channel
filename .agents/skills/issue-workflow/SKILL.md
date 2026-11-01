---
name: issue-workflow
description: Run qlink-channel GitHub Issue work through the project management workflow. Use when the user gives an Issue number, asks to start, continue or move an Issue through a stage (Requirement, Design, Test Criteria, Breakdown, Implementation, PR), or asks to turn a chat discussion into an Issue. Examples - "이슈 12 진행", "#12 이어서", "디자인 시안 보여줘", "테스트 기준 잡자", "이거 이슈로 등록해줘".
---

# Issue Workflow

`references/project-management-workflow.md` in this skill folder holds every rule. Read it first, every time. This skill only finds where the work stands and which reference the stage needs.

## 1. Load the Issue

No Issue number and new work → follow `1. Request` in the workflow, then continue here.

With a number, read type, body and sub-issues in one call:

```
gh api graphql -F n=<n> -f query='query($n:Int!){repository(owner:"QLink-Bookmarks",name:"qlink-channel"){issue(number:$n){number title state issueType{name} body subIssues(first:20){nodes{number state repository{name}}}}}}'
```

Then the Project `Status`:

```
gh api graphql -F n=<n> -f query='query($n:Int!){repository(owner:"QLink-Bookmarks",name:"qlink-channel"){issue(number:$n){projectItems(first:5){nodes{id project{number title} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
```

If the second call fails for a missing `project` scope, judge by the body alone and tell the user the `Status` could not be read.

## 2. Find the stage

1. Skipped stages come from the type, per the workflow's issue types table. No type set → ask the user for it before anything else.
2. The last filled section in the body is the completed stage. `(생략)` counts as filled.
3. The next stage is the first section after it that the type does not skip.
4. Compare with the Project `Status`. The body wins; report a mismatch.
5. Section 6 lists PRs → check each with `gh pr view <pr> --json state`. All merged → `Complete`.

Tell the user the Issue, its type, the completed stage and the next one, then ask to proceed.

## 3. Run the stage

| Stage | Read | Writes |
|---|---|---|
| `Requirement` | workflow `2. Requirement` | section 2 |
| `Design` | `references/design-candidates.md` | section 3 |
| `Test Criteria` | `references/test-criteria.md` | section 4 |
| `Breakdown` | workflow `5. Breakdown` and `Across repos`, `AGENTS.md` | section 5 |
| `Implementation` | workflow `Implementation`, `AGENTS.md`, sections 2 to 5 | code and tests, in a worktree |
| `PR` | workflow `6. PR` | PR body, section 6 |

## 4. Close the stage

Draft in chat, wait for the user's confirmation, write only that section back with the workflow's body edit procedure, move `Status`, report the stage closed, and stop. Never start the next stage in the same turn.
