import { useInviteStore } from "@/stores/invite";
import { useShareIntentStore } from "@/stores/share-intent";
import { act, renderHook } from "@testing-library/react-native";

import { goHomeAfterInvite, useHomeEntry } from "./use-home-entry";

const mockRouter = { replace: jest.fn(), setParams: jest.fn() };
const mockConsumeReturn = jest.fn();
let mockPathname = "/home";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.requireActual("react").useEffect,
  useGlobalSearchParams: () => ({}),
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));

jest.mock("@/features/navigation/lib/return-destination", () => ({
  consumeReturnDestination: () => mockConsumeReturn(),
  rememberReturnDestination: jest.fn(),
}));

jest.mock("@/lib/session-storage", () => ({
  SessionStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

function runEntryFrame() {
  act(() => jest.advanceTimersByTime(16));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockConsumeReturn.mockReturnValue(null);
  mockPathname = "/home";
  useInviteStore.setState({ hasHydrated: true, pending: null });
  useShareIntentStore.setState({ hasHydrated: true, pending: null });
});

afterEach(() => {
  jest.useRealTimers();
});

it("waits for both stores before resuming the invite ahead of the share and return address", () => {
  const invite = { folderId: "3", token: "invite-token" };
  const share = { url: "https://example.com/share" };
  useInviteStore.setState({ hasHydrated: false, pending: invite });
  useShareIntentStore.setState({ hasHydrated: false, pending: share });
  const { result } = renderHook(useHomeEntry);

  runEntryFrame();
  act(() => useInviteStore.setState({ hasHydrated: true }));
  runEntryFrame();
  expect(result.current).toBe(false);
  expect(mockRouter.replace).not.toHaveBeenCalled();

  act(() => useShareIntentStore.setState({ hasHydrated: true }));
  runEntryFrame();
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/invite", params: invite });
  expect(useShareIntentStore.getState().pending).toBe(share);
  expect(mockConsumeReturn).not.toHaveBeenCalled();
});

it("keeps the failed invite's home visit and resumes the share on the next home entry", () => {
  const share = { url: "https://example.com/share" };
  useShareIntentStore.setState({ pending: share });
  goHomeAfterInvite(mockRouter);
  const { result, rerender } = renderHook(useHomeEntry);
  runEntryFrame();

  expect(result.current).toBe(true);
  expect(useShareIntentStore.getState().pending).toBe(share);
  expect(mockRouter.setParams).not.toHaveBeenCalled();

  mockPathname = "/folders";
  rerender(undefined);
  mockPathname = "/home";
  rerender(undefined);
  runEntryFrame();

  expect(mockRouter.setParams).toHaveBeenCalledTimes(1);
  expect(mockRouter.setParams).toHaveBeenCalledWith(
    expect.objectContaining({ pendingShareUrl: share.url }),
  );
  expect(useShareIntentStore.getState().pending).toBeNull();
  expect(mockConsumeReturn).not.toHaveBeenCalled();
});

it("opens a live share once while already on home", () => {
  const { rerender } = renderHook(useHomeEntry);
  runEntryFrame();
  const share = { url: "https://example.com/live-share", live: true } as const;

  act(() => useShareIntentStore.getState().setPending(share));
  rerender(undefined);
  runEntryFrame();

  expect(mockRouter.setParams).toHaveBeenCalledTimes(1);
  expect(mockRouter.setParams).toHaveBeenCalledWith(
    expect.objectContaining({ pendingShareUrl: share.url }),
  );
  expect(useShareIntentStore.getState().pending).toBeNull();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
