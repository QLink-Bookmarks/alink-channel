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

  it("marks a collapsed section that holds the current folder with its icon only and reads its name out", () => {
    const onToggle = jest.fn();
    render(
      <FolderSectionHeader
        currentFolder={{ name: "교토 여행 준비", emoji: "🧳" }}
        isOpen={false}
        section="mine"
        onAddPress={jest.fn()}
        onToggle={onToggle}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: "내 폴더 펼치기, 현재 폴더 교토 여행 준비 포함",
      expanded: false,
    });
    expect(screen.getByText("/", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("🧳", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(/교토 여행 준비/, { includeHiddenElements: true })).toBeNull();

    fireEvent.press(toggle);
    expect(onToggle).toHaveBeenCalledWith("mine");
  });

  it("drops the path once the section is open", () => {
    render(
      <FolderSectionHeader
        isOpen
        currentFolder={{ name: "교토 여행 준비", emoji: "🧳" }}
        section="shared"
        onAddPress={jest.fn()}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "공유 폴더 접기", expanded: true })).toBeTruthy();
    expect(screen.queryByText("🧳", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText("/", { includeHiddenElements: true })).toBeNull();
  });

  it("falls back to a folder emoji when the current folder has none", () => {
    render(
      <FolderSectionHeader
        currentFolder={{ name: "읽을거리", emoji: null }}
        isOpen={false}
        section="shared"
        onAddPress={jest.fn()}
        onToggle={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "공유 폴더 펼치기, 현재 폴더 읽을거리 포함" }),
    ).toBeTruthy();
    expect(screen.getByText("📁", { includeHiddenElements: true })).toBeTruthy();
  });
});
