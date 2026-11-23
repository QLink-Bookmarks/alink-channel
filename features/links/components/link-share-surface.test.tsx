import { fireEvent, render, screen } from "@testing-library/react-native";

import { LinkShareSurface } from "./link-share-surface";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock("./link-share-sheet", () => ({
  LinkShareSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
}));
jest.mock("@/features/folders/queries", () => ({
  useFolderDetailQuery: () => ({ data: { isPublic: true } }),
}));

const original = "https://example.org/articles/jeju";
const props = {
  mode: "screen",
  linkId: 137,
  folderId: 1,
  isOwner: true,
  isPublic: true,
  pending: false,
  failed: false,
  url: original,
  onChange: async () => {},
  onShare: () => {},
} as const;

test("shows the confirmed public address above the original URL", () => {
  render(<LinkShareSurface {...props} />);
  fireEvent.press(screen.getByRole("button", { name: "공유" }));

  expect(screen.getByRole("radio", { name: "전체 공개", checked: true })).toBeVisible();
  expect(screen.getByText("/links/137")).toBeVisible();
  expect(screen.getByText(original)).toBeVisible();
});

test.each([
  { isOwner: false, isPublic: true },
  { isOwner: true, isPublic: undefined },
])("keeps original sharing when visibility is unavailable (%o)", (privacy) => {
  const share = jest.fn();
  render(
    <LinkShareSurface
      {...props}
      {...privacy}
      onShare={share}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "공유" }));

  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByRole("button", { name: "공개 주소 복사" })).toBeNull();
  expect(screen.getByText(original)).toBeVisible();
  fireEvent.press(screen.getByRole("button", { name: "원본 링크 공유" }));
  expect(share).toHaveBeenCalledTimes(1);
});
