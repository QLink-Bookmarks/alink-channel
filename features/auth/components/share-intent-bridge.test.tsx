import { useShareIntentStore } from "@/stores/share-intent";
import { render } from "@testing-library/react-native";

import { ShareIntentBridge } from "./share-intent-bridge";

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
const mockResetShareIntent = jest.fn();
const mockShareIntent = { webUrl: "https://example.com/shared" };
let mockHasShareIntent: boolean;
let mockHasResolved: boolean;

jest.mock("expo-router", () => ({
  usePathname: () => "/folders/3",
  useRootNavigationState: () => ({ key: "root" }),
  useRouter: () => mockRouter,
}));

jest.mock("expo-share-intent", () => ({
  useShareIntentContext: () => ({
    hasShareIntent: mockHasShareIntent,
    shareIntent: mockShareIntent,
    resetShareIntent: mockResetShareIntent,
  }),
}));

jest.mock("@/features/agreements/hooks/use-agreement-status", () => ({
  useAgreementStatus: () => ({
    hasHydrated: true,
    hasResolved: mockHasResolved,
    needsAgreement: false,
  }),
}));

jest.mock("@/lib/session-storage", () => ({
  SessionStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHasShareIntent = true;
  mockHasResolved = false;
  useShareIntentStore.setState({ hasHydrated: true, pending: null });
});

it("resumes a new share once when the protected screen's agreement check finishes", () => {
  const { rerender } = render(<ShareIntentBridge />);
  expect(mockResetShareIntent).toHaveBeenCalledTimes(1);
  expect(useShareIntentStore.getState().pending).toEqual({ url: mockShareIntent.webUrl });
  expect(mockPush).not.toHaveBeenCalled();

  mockHasShareIntent = false;
  rerender(<ShareIntentBridge />);
  expect(mockPush).not.toHaveBeenCalled();

  mockHasResolved = true;
  rerender(<ShareIntentBridge />);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/app");

  mockHasResolved = false;
  rerender(<ShareIntentBridge />);
  mockHasResolved = true;
  rerender(<ShareIntentBridge />);
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it("leaves a previously stored share to the next explicit app entry", () => {
  mockHasShareIntent = false;
  mockHasResolved = true;
  const pending = { url: mockShareIntent.webUrl };
  useShareIntentStore.setState({ pending });

  render(<ShareIntentBridge />);

  expect(mockPush).not.toHaveBeenCalled();
  expect(useShareIntentStore.getState().pending).toBe(pending);
});
