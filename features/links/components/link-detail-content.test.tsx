import { Text } from "react-native";

import { render, screen } from "@testing-library/react-native";

import { LinkDetailContent } from "./link-detail-content";

jest.mock("@/components/layout/app-header", () => ({ AppHeader: () => null }));
jest.mock("./link-detail-ai-surface", () => ({ LinkDetailAiSurface: () => null }));
jest.mock("./link-detail-head", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { LinkDetailHead: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock("./link-detail-parts", () => ({ DetailRow: () => null }));

it.each(["panel", "screen"] as const)(
  "shows the notes heading only in member detail in %s mode",
  (mode) => {
    const head = { mode, title: "제주 동쪽 해안 산책", url: "https://example.com/links/229" };
    const notes = <Text testID="link-detail-folder-row">제주 산책 기록</Text>;
    const view = render(
      <LinkDetailContent
        head={{ ...head, readOnly: true }}
        notes={notes}
      />,
    );

    expect(screen.getByText(head.title)).toBeOnTheScreen();
    expect(screen.queryByRole("heading")).toBeNull();
    for (const title of ["내 정리", "보관 폴더"]) {
      expect(screen.queryByText(title)).toBeNull();
      expect(screen.queryByLabelText(title)).toBeNull();
    }
    expect(screen.getByTestId("link-detail-folder-row")).toBeOnTheScreen();

    view.rerender(
      <LinkDetailContent
        head={head}
        notes={notes}
      />,
    );

    expect(screen.getByRole("heading", { name: "내 정리" })).toBeOnTheScreen();
    expect(screen.getByLabelText("내 정리")).toHaveProp("testID", "link-detail-my-notes");
    expect(screen.getByTestId("link-detail-folder-row")).toBeOnTheScreen();
  },
);
