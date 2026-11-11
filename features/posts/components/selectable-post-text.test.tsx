import { render, screen } from "@testing-library/react-native";

import { SelectablePostText } from "./selectable-post-text";

describe("SelectablePostText on iOS", () => {
  it("shows the text as a read-only, non-scrolling multiline field for partial selection", () => {
    render(<SelectablePostText>{"첫 줄 공지\n둘째 줄 공지"}</SelectablePostText>);
    const field = screen.getByDisplayValue("첫 줄 공지\n둘째 줄 공지");
    expect(field.props.editable).toBe(false);
    expect(field.props.multiline).toBe(true);
    expect(field.props.scrollEnabled).toBe(false);
  });
});
