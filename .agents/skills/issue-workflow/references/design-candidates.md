# Design Candidates

How to present design options at the `Design` stage of `references/project-management-workflow.md`.

Use the `impeccable` skill to create and critique design candidates. Apply its `adapt` guidance when checking responsive layouts.

## How many

Two or three. One is not a choice; four or more stops being comparable.

## What to vary

Vary exactly one axis across the candidates and say which one: layout, information hierarchy, or interaction pattern. Candidates that differ only in color, spacing, or font are not candidates.

## What each artifact must do

- Plain HTML, laid out for web wide and web mobile only. The artifact settles layout and hierarchy, not the native rendering; the real screens get checked from the implementation captures later.
- Use the repo's theme tokens. Never hardcode a color.
- Mirror the existing `components/ui` primitives instead of inventing new ones.
- Show the states section 2 names — at minimum the empty and error states, not only the filled happy path.

## Breakpoint

Use the viewport width as the breakpoint: `768px` or less uses the web mobile layout (including an iPad at `768px` in portrait); more than `768px` uses the web wide layout. Check both layouts at the breakpoint boundary.

## Theme toggle

Any candidate that changes UI carries a mode and accent toggle in one artifact, not one artifact per combination. Accents are `gray`, `pink`, `blue` (`lib/accent.ts`); modes are light and dark, so six combinations.

- Copy the custom property blocks out of `global.css` instead of retyping values, so the artifact cannot drift from the app.
- `global.css` keys dark mode off `.dark:root` and accents off `:root[data-accent="..."]`. In the artifact, drive both from attributes on `<html>`: `data-theme="light|dark"` and `data-accent="gray|pink|blue"`, rewriting `.dark:root` to `:root[data-theme="dark"]`.
- Default to the viewer's `prefers-color-scheme` and `gray`.
- Put both toggles in the same place on every candidate so switching does not move the controls.

## How to present

- Lead with one recommendation, not a neutral menu.
- Give each candidate a one-line intent and name what it gives up.
- Keep candidates and their links in chat. Nothing goes in the Issue until one is picked.

## Critique scores

Run the `impeccable` critique and record its Design Health Score (Nielsen heuristics, `/40` or the renormalized maximum) at four points, so the pick and the implementation can be compared on one scale:

| Point | Target | When |
|---|---|---|
| `baseline` | the current screen on `main` | before candidates exist |
| `candidate-<X>` | each candidate artifact | before presenting them |
| `revised` | the picked candidate after the requested changes | each revision round |
| `final` | the implemented screen, captured from the app | before the PR |

- Same viewports every time: web wide `1280px` and web mobile `390px`, light and dark. Native captures (iPhone, iPad) are added at `final` when the Issue has iOS criteria.
- Present candidates with their scores and P1 lists next to the recommendation.
- A `final` more than 2 points below `revised` (or `baseline` when there were no candidates), or carrying any P0/P1, is reworked once and critiqued again before the PR opens.
- The PR body carries the score table.

## After the pick

Write into Issue section 3 and nothing more:

- Behavior and screen transitions, as text.
- One line per capture, naming the image file and the state it must show: `- 12_01_folder-empty.png — 폴더가 없을 때의 빈 상태`

The user uploads the images onto those lines, so never rewrite section 3 after they do.
