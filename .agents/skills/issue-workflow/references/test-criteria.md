# Test Criteria

Conditions the user walks through by hand to judge whether a feature works and is finished, without reading code. Read this at the `Test Criteria` stage of `references/project-management-workflow.md`.

Draft the list, review it with the user in chat, then write the confirmed version into Issue section 4.

## Form

- One condition per line, as a checkbox: `- [ ] <observable result>`
- Write what is visible on screen, not what the code does. No function names, no state names, no HTTP status codes.
- No scenario codes, no tables, no Given/When/Then.
- Pair a success condition with its failure condition wherever an action can fail.
- Append the scope only when a condition does not apply everywhere: `— 웹 와이드`, `— 웹 모바일`, `— iOS`. Omit it when it applies to all.
- Order them so the user can run the list top to bottom in one sitting.

Good: `- [ ] 폴더 이름을 비우고 저장하면 안내 문구가 뜨고 폴더가 만들어지지 않는다`
Bad: `- [ ] validateFolderName이 빈 문자열을 거부한다` — implementation, not observable
Bad: `- [ ] 폴더 생성이 정상 동작한다` — not a checkable condition

## Coverage

Nine axes. Every one of them is accounted for in the coverage checklist below, whether or not it produces a test case.

1. **Happy path** — every goal in section 2 reached end to end
2. **Input validation** — empty, whitespace only, over max length, duplicate, forbidden characters, Korean typed fast through the IME
3. **States** — loading, empty, error, no permission, request failure, retry after failure
4. **Boundaries** — list with 0 / 1 / many items, very long text, missing or broken image, truncated title
5. **Navigation** — back, deep link straight into the screen, return from background, web refresh and direct URL entry
6. **Repetition** — double tap on submit, repeated submit, leaving mid-flow and re-entering
7. **Data propagation** — after create / edit / delete, the list and every other screen showing the same data reflect it
8. **Platform differences** — web wide, web mobile, iOS, and what is intentionally absent on one of them
9. **Finish** — safe area top and bottom, dark mode, keyboard not covering the focused field, touch targets reachable

## Coverage checklist

Section 4 always ends with this fixed block, below the test cases. It is not a list of test cases; it is the record that no axis was dropped unnoticed. Keep the lines in this order and this wording, every time, for every issue type. Check an axis once its cases are written, and append `(Not Scope)` to one the issue does not touch.

```
### 커버리지 점검
- [ ] 정상 경로
- [ ] 입력 검증
- [ ] 상태 (로딩·빈 상태·오류·권한·요청 실패)
- [ ] 경계값
- [ ] 화면 이동·복귀
- [ ] 반복 동작
- [ ] 데이터 반영
- [ ] 플랫폼 차이
- [ ] 완성도 (세이프 에어리어·다크모드·키보드·터치 영역)
```

## Lightweight path

`Bug` and `Refactor` issues do not walk all nine axes. Write the required lines, then add only the axes the change actually touches; the rest are marked `(Not Scope)` in the coverage checklist, so do not also narrate them in chat.

**Bug** — required:

- the reported reproduction steps no longer reproduce it
- the intended behavior now completes end to end (axis 1)
- the neighbouring actions on the same screen or flow still work
- it holds on the platform where it appeared and on the others (axis 8)

Then add the axis the cause sits in: input validation bug adds axis 2, loading or error handling adds 3, a list not refreshing adds 7, back or deep link adds 5, double submit adds 6, layout or dark mode adds 9.

**Refactor** — required: axis 1 across every path the touched code serves, axis 7, and axis 8. Then add only the axes the touched code is responsible for: form logic adds 2, query and loading state adds 3, routing adds 5, UI structure adds 9. Axes 4 and 6 come in only when that logic was edited directly.

## Scope

- Derive conditions only from the confirmed sections 2 and 3. If a condition cannot be decided from them, ask in chat instead of inventing a rule.
- Do not include a condition the user cannot check from the UI.
- Do not restate one condition once per platform; use the scope suffix.
- Do not set a performance number unless section 2 set one.
