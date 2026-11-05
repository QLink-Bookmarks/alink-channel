import { Text } from "react-native";

import { render, screen } from "@testing-library/react-native";

import { AppHeader, type AppHeaderTitleAlign } from "./app-header";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

/** Host node of `screen.toJSON()`. */
type HostNode = {
  children: (HostNode | string)[] | null;
  props: Record<string, unknown>;
  type: string;
};

function hostChildren(node: HostNode): HostNode[] {
  return (node.children ?? []).filter((child): child is HostNode => typeof child !== "string");
}

function findHost(node: HostNode, matches: (node: HostNode) => boolean): HostNode | undefined {
  if (matches(node)) {
    return node;
  }
  for (const child of hostChildren(node)) {
    const found = findHost(child, matches);
    if (found) {
      return found;
    }
  }
  return undefined;
}

const isTestId = (testID: string) => (node: HostNode) => node.props.testID === testID;
const isBackButton = (node: HostNode) => node.props.accessibilityLabel === "뒤로";

/**
 * Renders the header and returns its direct host children, each tagged with what it holds:
 * the back button, the title, the right slot.
 */
function renderHeaderColumns(titleAlign?: AppHeaderTitleAlign) {
  render(
    <AppHeader
      back
      rightSlot={<Text>actions</Text>}
      title="폴더 이름"
      titleAlign={titleAlign}
      onBack={() => {}}
    />,
  );
  const root = screen.toJSON() as HostNode;
  const header = findHost(root, isTestId("app-header"));
  if (!header) {
    throw new Error("app-header not rendered");
  }
  return hostChildren(header).map((column) => ({
    hasBack: findHost(column, isBackButton) != null,
    hasTitle: findHost(column, isTestId("app-header-title")) != null,
    isTitle: column.props.testID === "app-header-title",
    isRight: column.props.testID === "app-header-right",
  }));
}

describe("AppHeader titleAlign", () => {
  it("centers the title in its own column between the back button and the right slot by default", () => {
    const columns = renderHeaderColumns();

    expect(columns).toEqual([
      { hasBack: true, hasTitle: false, isTitle: false, isRight: false },
      { hasBack: false, hasTitle: true, isTitle: true, isRight: false },
      { hasBack: false, hasTitle: false, isTitle: false, isRight: true },
    ]);
  });

  it("keeps that layout for an explicit center", () => {
    expect(renderHeaderColumns("center")).toEqual(renderHeaderColumns());
  });

  it("puts the title right after the back button in one group for start, then the right slot", () => {
    const columns = renderHeaderColumns("start");

    expect(columns).toEqual([
      { hasBack: true, hasTitle: true, isTitle: false, isRight: false },
      { hasBack: false, hasTitle: false, isTitle: false, isRight: true },
    ]);

    // Inside the group the back button comes first and the title last.
    const root = screen.toJSON() as HostNode;
    const header = findHost(root, isTestId("app-header")) as HostNode;
    const group = hostChildren(header)[0];
    const groupChildren = hostChildren(group);
    expect(findHost(groupChildren[0], isBackButton) != null).toBe(true);
    expect(groupChildren.at(-1)?.props.testID).toBe("app-header-title");
  });

  it("keeps the title to one line in both alignments", () => {
    for (const titleAlign of ["center", "start"] as const) {
      const { unmount } = render(
        <AppHeader
          back
          title="아주 긴 폴더 이름"
          titleAlign={titleAlign}
        />,
      );
      expect(screen.getByTestId("app-header-title").props.numberOfLines).toBe(1);
      unmount();
    }
  });
});
