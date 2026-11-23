import { useToastStore } from "@/stores/toast-store";
import { render } from "@testing-library/react-native";

import { UnavailableResourceRedirect } from "./resource-access";

const mockAuth = { hasHydrated: true, accessToken: null as string | null };
const mockReplace = jest.fn();
let mockFocused = true;

jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("expo-router/head", () => () => null);
jest.mock("@/stores/auth", () => ({
  useAuthStore: (select: (state: typeof mockAuth) => unknown) => select(mockAuth),
}));
jest.mock("@/features/agreements/hooks/use-agreement-status", () => ({}));
jest.mock("@/features/folders/api", () => ({}));
jest.mock("@/features/links/api", () => ({}));
jest.mock("./guest-resource-navigation", () => ({}));
jest.mock("./mobile-bottom-tabs", () => ({}));
jest.mock("./private-pages-layout", () => ({}));

beforeEach(() => {
  mockAuth.hasHydrated = true;
  mockAuth.accessToken = null;
  mockFocused = true;
  mockReplace.mockClear();
  useToastStore.getState().dismissAllToasts();
});

it.each([
  ["member", "/home"],
  [null, "/login"],
])("replaces a denied native route with session %s", (token, destination) => {
  mockAuth.accessToken = token;
  render(
    <UnavailableResourceRedirect
      kind="folders"
      id={42}
    />,
  );

  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith(destination);
  const items = useToastStore.getState().items;
  if (destination === "/login") {
    expect(items).toEqual([]);
  } else {
    expect(items).toEqual([
      expect.objectContaining({
        title: "폴더를 찾을 수 없어요",
        description: "삭제되었거나 접근 권한이 없어요.",
        sourceKey: "resource-unavailable:folders:42",
      }),
    ]);
  }
});

it("waits for focus and hydration, then announces the denied link once", () => {
  mockAuth.hasHydrated = false;
  mockFocused = false;
  const view = render(
    <UnavailableResourceRedirect
      kind="links"
      id={27}
    />,
  );
  expect(mockReplace).not.toHaveBeenCalled();

  mockAuth.hasHydrated = true;
  mockAuth.accessToken = "member";
  view.rerender(
    <UnavailableResourceRedirect
      kind="links"
      id={27}
    />,
  );
  expect(mockReplace).not.toHaveBeenCalled();

  mockFocused = true;
  view.rerender(
    <UnavailableResourceRedirect
      kind="links"
      id={27}
    />,
  );
  expect(mockReplace).toHaveBeenCalledWith("/home");
  expect(useToastStore.getState().items).toEqual([
    expect.objectContaining({ title: "찾으시는 링크가 없어요" }),
  ]);

  useToastStore.getState().dismissAllToasts();
  mockAuth.accessToken = "refreshed";
  view.rerender(
    <UnavailableResourceRedirect
      kind="links"
      id={27}
    />,
  );
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(useToastStore.getState().items).toEqual([]);
});
