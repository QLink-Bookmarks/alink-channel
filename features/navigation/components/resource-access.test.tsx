import { AppState, Text } from "react-native";

import { usePublicResource } from "@/features/navigation/hooks/use-public-resource";
import { useToastStore } from "@/stores/toast-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";

import { ResourceAccess, UnavailableResourceRedirect } from "./resource-access";

const mockAuth = { hasHydrated: true, accessToken: null as string | null };
const mockReplace = jest.fn();
const mockGetFolderDetail = jest.fn();
const mockGetLinkAccess = jest.fn();
let mockPath = "/folders/42";

jest.mock("expo-router", () => ({
  Navigator: {
    useContext: () => {
      const [, kind, id] = mockPath.split("/");
      return { state: { index: 0, routes: [{ name: `${kind}/[id]`, params: { id } }] } };
    },
  },
  useGlobalSearchParams: () => ({}),
  useIsFocused: () => true,
  usePathname: () => mockPath,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("expo-router/head", () => () => null);
jest.mock("@/stores/auth", () => ({
  useAuthStore: (select: (state: typeof mockAuth) => unknown) => select(mockAuth),
}));
jest.mock("@/features/agreements/hooks/use-agreement-status", () => ({
  useAgreementStatus: () => ({ hasResolved: true, needsAgreement: false }),
}));
jest.mock("@/features/folders/api", () => ({
  getFolderDetail: (...args: unknown[]) => mockGetFolderDetail(...args),
}));
jest.mock("@/features/links/api", () => ({
  getLinkAccess: (...args: unknown[]) => mockGetLinkAccess(...args),
}));
jest.mock("./guest-resource-navigation", () => ({
  GuestResourceNavigation: ({ children }: { children: () => React.ReactNode }) => children(),
}));
jest.mock("./mobile-bottom-tabs", () => ({ MobileBottomTabs: () => null }));
jest.mock("./private-pages-layout", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { PrivatePagesLayout: () => <Text>member layout</Text> };
});

beforeEach(() => {
  mockAuth.hasHydrated = true;
  mockAuth.accessToken = null;
  mockPath = "/folders/42";
  mockReplace.mockClear();
  mockGetFolderDetail.mockReset();
  mockGetLinkAccess.mockReset();
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
  expect(items).toEqual([
    expect.objectContaining({
      title: "폴더를 찾을 수 없어요",
      description: "삭제되었거나 접근 권한이 없어요.",
      sourceKey: "resource-unavailable:folders:42",
    }),
  ]);
});

function ResourceProbe() {
  const visit = usePublicResource();
  const resource = visit?.resource;
  return <Text>{resource?.mode === "folder" ? resource.data.name : resource?.data.title}</Text>;
}

function renderResource() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ResourceAccess>
        <ResourceProbe />
      </ResourceAccess>
    </QueryClientProvider>,
  );
}

it("passes an iOS member response to the existing protected layout", async () => {
  mockAuth.accessToken = "member";
  mockGetFolderDetail.mockResolvedValue({ success: true, data: { id: 42, isShared: true } });

  renderResource();

  expect(await screen.findByText("member layout")).toBeOnTheScreen();
  expect(mockGetFolderDetail).toHaveBeenCalledWith(
    42,
    expect.objectContaining({ authToken: "member" }),
  );
});

it.each([null, "visitor"])(
  "rechecks an iOS public link on foreground with session %s",
  async (token) => {
    mockAuth.accessToken = token;
    mockPath = "/links/27";
    mockGetLinkAccess
      .mockResolvedValueOnce({ success: true, data: { id: 27, folderId: 42, title: "공개 링크" } })
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    const addListener = jest.spyOn(AppState, "addEventListener").mockImplementation(() => ({
      remove: jest.fn(),
    }));

    try {
      renderResource();
      expect(await screen.findByText("공개 링크")).toBeOnTheScreen();
      expect(mockGetLinkAccess).toHaveBeenCalledWith(
        27,
        expect.objectContaining({ authToken: token }),
      );

      const onAppStateChange = addListener.mock.calls.at(-1)?.[1];
      expect(onAppStateChange).toBeDefined();
      act(() => {
        onAppStateChange?.("inactive");
        onAppStateChange?.("background");
        onAppStateChange?.("active");
      });

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(token ? "/home" : "/login"));
      expect(mockGetLinkAccess).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("공개 링크")).toBeNull();
      expect(useToastStore.getState().items).toEqual([
        expect.objectContaining({ title: "찾으시는 링크가 없어요" }),
      ]);
    } finally {
      addListener.mockRestore();
    }
  },
);

it("waits for the active address and hydration, then announces the denied link once", () => {
  mockAuth.hasHydrated = false;
  mockPath = "/links/27";
  const view = render(
    <UnavailableResourceRedirect
      kind="links"
      id={27}
    />,
  );
  expect(mockReplace).not.toHaveBeenCalled();

  mockAuth.hasHydrated = true;
  mockAuth.accessToken = "member";
  mockPath = "/home";
  view.rerender(
    <UnavailableResourceRedirect
      kind="links"
      id={27}
    />,
  );
  expect(mockReplace).not.toHaveBeenCalled();

  mockPath = "/links/27";
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
