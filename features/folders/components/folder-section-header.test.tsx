import { fireEvent, render, screen } from "@testing-library/react-native";

import { FolderSectionHeader } from "./folder-section-header";

describe("FolderSectionHeader", () => {
  it("names the toggle by the action it takes and reports the expanded state", () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <FolderSectionHeader
        isOpen
        section="mine"
        onAddPress={jest.fn()}
        onToggle={onToggle}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "내 폴더 접기", expanded: true }));
    expect(onToggle).toHaveBeenCalledWith("mine");

    rerender(
      <FolderSectionHeader
        isOpen={false}
        section="mine"
        onAddPress={jest.fn()}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByRole("button", { name: "내 폴더 펼치기", expanded: false })).toBeTruthy();
  });

  it("names the add button without the plus sign and passes the section", () => {
    const onAddPress = jest.fn();
    render(
      <FolderSectionHeader
        isOpen={false}
        section="shared"
        onAddPress={onAddPress}
        onToggle={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "공유 폴더에 폴더 추가" }));
    expect(onAddPress).toHaveBeenCalledWith("shared");
    expect(screen.queryByRole("button", { name: /\+/ })).toBeNull();
  });
});
