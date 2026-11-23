import { useToastStore } from "@/stores/toast-store";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { PublicAddressRow } from "./public-address-row";

import * as Clipboard from "expo-clipboard";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@/lib/app-variant", () => ({
  getWebAppOrigin: () => "https://dev.archivelink.app",
}));

const setStringAsync = jest.mocked(Clipboard.setStringAsync);

beforeEach(() => {
  setStringAsync.mockReset();
  useToastStore.getState().dismissAllToasts();
});

test.each(["/folders/137", "/links/137"] as const)("copies the full %s address", async (path) => {
  setStringAsync.mockResolvedValue(true);
  render(<PublicAddressRow path={path} />);

  expect(screen.getByText(path)).toBeVisible();
  fireEvent.press(screen.getByRole("button", { name: "공개 주소 복사" }));

  await waitFor(() => {
    expect(setStringAsync).toHaveBeenCalledWith(`https://dev.archivelink.app${path}`);
    expect(useToastStore.getState().items[0]).toMatchObject({
      title: "공개 주소를 복사했어요.",
      variant: "success",
    });
  });
});

test("expands the selectable address when copying fails and collapses it after a retry", async () => {
  setStringAsync.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<PublicAddressRow path="/folders/137" />);

  const copy = screen.getByRole("button", { name: "공개 주소 복사" });
  fireEvent.press(copy);

  expect(await screen.findByText("https://dev.archivelink.app/folders/137")).toHaveProp(
    "selectable",
    true,
  );
  expect(useToastStore.getState().items[0]).toMatchObject({
    title: "공개 주소를 복사하지 못했어요. 다시 시도해주세요.",
    variant: "error",
  });

  fireEvent.press(copy);
  expect(await screen.findByText("/folders/137")).toBeVisible();
  expect(screen.queryByText("https://dev.archivelink.app/folders/137")).toBeNull();
});
