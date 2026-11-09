import type * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react-native";

import { SidebarItem, SidebarRailItem } from "./sidebar";

import { Menu } from "lucide-react-native/icons";

jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

describe("SidebarRailItem", () => {
  it("is a button named by its label unless an accessible name is given", () => {
    const onPress = jest.fn();
    render(
      <>
        <SidebarRailItem
          icon={Menu}
          label="사이드바 펼치기"
          onPress={onPress}
        />
        <SidebarRailItem
          accessibilityLabel="미분류, 링크 12개"
          emoji="🗂️"
          label="미분류"
        />
      </>,
    );

    fireEvent.press(screen.getByRole("button", { name: "사이드바 펼치기" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "미분류, 링크 12개" })).toBeTruthy();
  });

  it("reads the current item as selected on native", () => {
    render(
      <SidebarRailItem
        active
        accessibilityLabel="읽을거리, 선택된 폴더"
        emoji="📚"
        label="읽을거리"
      />,
    );
    expect(
      screen.getByRole("button", { name: "읽을거리, 선택된 폴더", selected: true }),
    ).toBeTruthy();
  });
});

describe("SidebarItem", () => {
  it("reads the current folder as selected and others as not", () => {
    render(
      <>
        <SidebarItem
          active
          accessibilityLabel="폴더 1, 링크 2개"
          label="폴더 1"
        />
        <SidebarItem
          accessibilityLabel="폴더 2, 링크 0개"
          label="폴더 2"
        />
      </>,
    );
    expect(screen.getByRole("button", { name: "폴더 1, 링크 2개", selected: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "폴더 2, 링크 0개", selected: false })).toBeTruthy();
  });
});
