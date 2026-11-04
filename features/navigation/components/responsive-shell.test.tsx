import * as React from "react";
import { View } from "react-native";

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ResponsiveShell } from "./responsive-shell";

const mockRoute = {
  pathname: "/notifications",
  params: {} as Record<string, string>,
};
const mockFormMounts = { count: 0 };

const mockRouter = {
  back: jest.fn(),
  canGoBack: () => false,
  push: jest.fn(),
  replace: jest.fn(),
  setParams: (next: Record<string, string>) => {
    mockRoute.params = { ...mockRoute.params, ...next };
  },
};

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useGlobalSearchParams: () => mockRoute.params,
  useRouter: () => mockRouter,
}));

jest.mock("../hooks/use-shell-route-state", () => ({
  useShellRouteState: () => ({
    isWideView: true,
    mobileTabKey: null,
    overlayBaseHref: mockRoute.pathname,
    overlayLinkId: undefined,
    pathname: mockRoute.pathname,
    redirectHref: null,
    routeTitle: "",
    showBackButton: false,
    wideSidebarKey: null,
  }),
}));

jest.mock("../hooks/use-link-overlay-state", () => ({
  useLinkOverlayState: () => ({
    detail: undefined,
    error: false,
    handleOpenChange: jest.fn(),
    isLoading: false,
    isOpen: false,
    notFound: false,
  }),
}));

jest.mock("../hooks/use-wide-shell-insets", () => ({
  useWideShellInsets: () => ({ top: 0, bottom: 0 }),
}));

jest.mock("./wide-sidebar-column", () => {
  const { Pressable: MockPressable, Text: MockText } = jest.requireActual("react-native");
  return {
    WideSidebarColumn: ({ onAddLinkPress }: { onAddLinkPress: () => void }) => (
      <MockPressable
        accessibilityRole="button"
        onPress={onAddLinkPress}
      >
        <MockText>새 링크</MockText>
      </MockPressable>
    ),
  };
});

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogHeader: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/features/links/components/link-create-form", () => {
  const MockReact = jest.requireActual("react");
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual("react-native");
  return {
    LinkCreateForm: ({ initialUrl }: { initialUrl?: string }) => {
      const [typed, setTyped] = MockReact.useState("");
      const [isPopoverOpen, setIsPopoverOpen] = MockReact.useState(false);
      MockReact.useEffect(() => {
        mockFormMounts.count += 1;
      }, []);
      return (
        <MockView>
          <MockText testID="form-url">{initialUrl ?? ""}</MockText>
          <MockText testID="form-typed">{typed}</MockText>
          <MockPressable
            accessibilityRole="button"
            onPress={() => setTyped("직접 쓴 제목")}
          >
            <MockText>type</MockText>
          </MockPressable>
          <MockPressable
            accessibilityRole="button"
            onPress={() => setIsPopoverOpen(true)}
          >
            <MockText>folder</MockText>
          </MockPressable>
          {isPopoverOpen ? <MockText>folder popover</MockText> : null}
        </MockView>
      );
    },
  };
});

jest.mock("@/components/error/route-error-boundary", () => ({
  RouteErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/layout/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/components/layout/bottom-tabs", () => ({ BottomTabs: () => null }));
jest.mock("@/components/layout/brand-header", () => ({ BrandHeader: () => null }));
jest.mock("@/components/layout/fab", () => ({ Fab: () => null }));
jest.mock("@/components/layout/sheet", () => ({ Sheet: () => null }));
jest.mock("@/components/layout/topbar", () => ({ Topbar: () => null }));
jest.mock("@/components/ui/icon-button", () => ({ IconButton: () => null }));
jest.mock("@/features/announcements/components/announcements-header-action", () => ({
  AnnouncementsHeaderAction: () => null,
}));
jest.mock("@/features/folders/components/create-folder-dialog", () => ({
  CreateFolderDialog: () => null,
}));
jest.mock("@/features/folders/components/folder-header-actions", () => ({
  FolderHeaderActions: () => null,
}));
jest.mock("@/features/folders/hooks/use-section-accordion", () => ({
  FOLDER_SECTIONS_SHEET_TIMING: {},
}));
jest.mock("@/features/folders/lib/folder-pages", () => ({ UNCATEGORIZED_FOLDER_ID: 0 }));
jest.mock("@/features/folders/queries", () => ({ useFolderQuery: () => ({ folder: undefined }) }));
jest.mock("@/features/links/components/detail-panel/detail-panel", () => ({
  DetailPanel: () => null,
}));
jest.mock("@/features/links/queries", () => ({ useLinkDetailQuery: () => ({ data: undefined }) }));
jest.mock("@/features/notifications/components/notification-bell-button", () => ({
  NotificationBellButton: () => null,
}));
jest.mock("@/features/search/components/search-dialog", () => ({ SearchDialog: () => null }));
const mockOpenSection = jest.fn();
jest.mock("@/stores/folder-navigation", () => ({
  setFolderScrollOffset: jest.fn(),
  useFolderNavigation: () => mockOpenSection,
}));

function Shell() {
  return (
    <ResponsiveShell>
      <View />
    </ResponsiveShell>
  );
}

function openDialogWithTypingAndPopover() {
  fireEvent.press(screen.getByText("새 링크"));
  fireEvent.press(screen.getByText("type"));
  fireEvent.press(screen.getByText("folder"));
  expect(screen.getByTestId("form-typed")).toHaveTextContent("직접 쓴 제목");
  expect(screen.getByText("folder popover")).toBeTruthy();
}

describe("ResponsiveShell wide new link dialog on a route change", () => {
  beforeEach(() => {
    mockRoute.pathname = "/notifications";
    mockRoute.params = {};
    mockFormMounts.count = 0;
  });

  it("closes the dialog when the pathname changes", () => {
    const view = render(<Shell />);
    openDialogWithTypingAndPopover();

    mockRoute.pathname = "/settings/imports/5";
    act(() => view.rerender(<Shell />));

    expect(screen.queryByTestId("form-url")).toBeNull();
    expect(screen.queryByText("folder popover")).toBeNull();
  });

  it("keeps the dialog when only the query changes", () => {
    const view = render(<Shell />);
    openDialogWithTypingAndPopover();

    mockRoute.params = { linkId: "3" };
    act(() => view.rerender(<Shell />));

    expect(screen.getByText("folder popover")).toBeTruthy();
    expect(screen.getByTestId("form-typed")).toHaveTextContent("직접 쓴 제목");
  });

  it("reopens a clean form with only the shared address when one arrives with a route change", () => {
    const view = render(<Shell />);
    openDialogWithTypingAndPopover();
    const mountsBefore = mockFormMounts.count;

    mockRoute.pathname = "/home";
    mockRoute.params = { linkUrl: "https://example.com/shared" };
    act(() => view.rerender(<Shell />));

    expect(mockFormMounts.count).toBe(mountsBefore + 1);
    expect(screen.getByTestId("form-url")).toHaveTextContent("https://example.com/shared");
    expect(screen.getByTestId("form-typed")).toHaveTextContent("");
    expect(screen.queryByText("folder popover")).toBeNull();
  });

  it("opens the dialog with the shared address when none was open", () => {
    const view = render(<Shell />);

    mockRoute.pathname = "/home";
    mockRoute.params = { linkUrl: "https://example.com/shared" };
    act(() => view.rerender(<Shell />));

    expect(screen.getByTestId("form-url")).toHaveTextContent("https://example.com/shared");
  });
});
