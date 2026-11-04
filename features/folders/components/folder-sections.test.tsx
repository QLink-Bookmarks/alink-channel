import * as React from "react";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { useFolderNavigation } from "@/stores/folder-navigation";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { type FolderSectionDefinition, FolderSectionsView } from "./folder-sections";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => mockReducedMotion,
}));
/* eslint-enable @typescript-eslint/no-require-imports */

type Row = { key: string; name: string };
type SectionKey = "existing" | "new";

const mounts = new Map<string, number>();

function PickerRow({
  row,
  selected,
  onPress,
}: {
  row: Row;
  selected: boolean;
  onPress: (row: Row) => void;
}) {
  React.useEffect(() => {
    mounts.set(row.key, (mounts.get(row.key) ?? 0) + 1);
  }, [row.key]);
  return (
    <Pressable
      accessibilityLabel={row.name}
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={() => onPress(row)}
    >
      <Text>{row.name}</Text>
    </Pressable>
  );
}

const SECTIONS: FolderSectionDefinition<SectionKey, Row>[] = [
  {
    key: "existing",
    label: "내 폴더",
    canAdd: false,
    rows: [
      { key: "existing:1", name: "여행" },
      { key: "existing:2", name: "레시피" },
    ],
  },
  { key: "new", label: "새 폴더", rows: [{ key: "new:1", name: "읽을거리" }] },
];

function getRowKey(row: Row) {
  return row.key;
}

function Harness({
  sections = SECTIONS,
  initialOpen = "existing",
  isListDeferred = false,
  renderSectionRow,
  onAddPress,
}: {
  sections?: FolderSectionDefinition<SectionKey, Row>[];
  initialOpen?: SectionKey | null;
  isListDeferred?: boolean;
  renderSectionRow?: (row: Row, section: SectionKey) => React.ReactElement;
  onAddPress?: (section: SectionKey) => void;
}) {
  const [openSection, setOpenSection] = React.useState<SectionKey | null>(initialOpen);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const handleToggle = React.useCallback(
    (section: SectionKey) => setOpenSection((current) => (current === section ? null : section)),
    [],
  );
  const handleRowPress = React.useCallback((row: Row) => setSelectedKey(row.key), []);
  const renderRow = React.useCallback(
    (row: Row) => (
      <PickerRow
        row={row}
        selected={selectedKey === row.key}
        onPress={handleRowPress}
      />
    ),
    [handleRowPress, selectedKey],
  );
  return (
    <FolderSectionsView
      getRowKey={getRowKey}
      isListDeferred={isListDeferred}
      openSection={openSection}
      sections={sections}
      tone="surface"
      renderRow={renderSectionRow ?? renderRow}
      onAddPress={onAddPress}
      onToggle={handleToggle}
    />
  );
}

const initialHasHydrated = useFolderNavigation.getState().hasHydrated;

const HIDDEN = { includeHiddenElements: true };

async function finishMotion() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function measureOpening(section: SectionKey, height: number) {
  fireEvent(screen.getByTestId(`folder-section-body-inner-${section}`, HIDDEN), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
  });
}

beforeEach(() => {
  mounts.clear();
  mockReducedMotion = false;
});

afterEach(async () => {
  await finishMotion();
  useFolderNavigation.setState({ hasHydrated: initialHasHydrated });
});

describe("FolderSectionsView", () => {
  it("shows the section labels, the rows of the open section only, and + only where allowed", () => {
    const onAddPress = jest.fn();
    render(<Harness onAddPress={onAddPress} />);

    expect(screen.getByRole("button", { name: "내 폴더 접기", expanded: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "새 폴더 펼치기", expanded: false })).toBeTruthy();
    expect(screen.getByLabelText("내 폴더 목록")).toBeTruthy();
    expect(screen.queryByLabelText("새 폴더 목록")).toBeNull();
    expect(screen.getByRole("radio", { name: "여행" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "읽을거리" })).toBeNull();

    expect(screen.queryByRole("button", { name: "내 폴더에 폴더 추가" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "새 폴더에 폴더 추가" }));
    expect(onAddPress).toHaveBeenCalledWith("new");
  });

  it("shows local rows on mount without a skeleton, next page or retry", () => {
    render(<Harness />);

    expect(screen.getByRole("radio", { name: "레시피" })).toBeTruthy();
    expect(screen.queryByLabelText("폴더를 불러오는 중")).toBeNull();
    expect(screen.queryByLabelText("폴더를 더 불러오는 중")).toBeNull();
    expect(screen.queryByText("다시 시도")).toBeNull();
    expect(screen.queryByText("아직 만든 폴더가 없어요")).toBeNull();
  });

  it("opens one section at a time through the controlled toggle", () => {
    render(<Harness />);

    fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));
    expect(screen.getByRole("button", { name: "내 폴더 펼치기", expanded: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "새 폴더 접기", expanded: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "읽을거리" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "여행" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "새 폴더 접기" }));
    expect(screen.queryByRole("radio", { name: "읽을거리" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "여행" })).toBeNull();
  });

  it("keeps the rows mounted when the selection changes", () => {
    render(<Harness />);
    expect(mounts.get("existing:1")).toBe(1);
    expect(mounts.get("existing:2")).toBe(1);

    fireEvent.press(screen.getByRole("radio", { name: "레시피" }));
    expect(screen.getByRole("radio", { name: "레시피", checked: true })).toBeTruthy();
    fireEvent.press(screen.getByRole("radio", { name: "여행" }));
    expect(screen.getByRole("radio", { name: "여행", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "레시피", checked: false })).toBeTruthy();

    expect(mounts.get("existing:1")).toBe(1);
    expect(mounts.get("existing:2")).toBe(1);
  });

  it("does not wait for the folder navigation store to hydrate", () => {
    useFolderNavigation.setState({ hasHydrated: false });
    render(<Harness initialOpen="new" />);

    expect(screen.getByRole("radio", { name: "읽을거리" })).toBeTruthy();
  });

  it("shows the empty note of an open section without rows", () => {
    render(
      <Harness
        initialOpen="new"
        sections={[
          SECTIONS[0],
          { ...SECTIONS[1], rows: [], emptyComponent: <Text>+로 새 폴더를 만들어요.</Text> },
        ]}
      />,
    );

    expect(screen.getByLabelText("새 폴더 목록")).toBeTruthy();
    expect(screen.getByText("+로 새 폴더를 만들어요.")).toBeTruthy();
  });

  it("keeps the closing list on screen, hidden from touch and screen readers, until it has collapsed", async () => {
    render(<Harness />);

    fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));
    expect(screen.queryByLabelText("내 폴더 목록")).toBeNull();
    expect(screen.getByLabelText("내 폴더 목록", HIDDEN)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "읽을거리" })).toBeTruthy();

    measureOpening("new", 48);
    await finishMotion();

    expect(screen.queryByLabelText("내 폴더 목록", HIDDEN)).toBeNull();
    expect(screen.getByRole("radio", { name: "읽을거리" })).toBeTruthy();
  });

  it("removes the list after collapsing all sections", async () => {
    render(<Harness />);

    fireEvent.press(screen.getByRole("button", { name: "내 폴더 접기" }));
    expect(screen.getByLabelText("내 폴더 목록", HIDDEN)).toBeTruthy();
    await finishMotion();

    expect(screen.queryByLabelText(/폴더 목록$/, HIDDEN)).toBeNull();
  });

  it("ends with the last tapped section when taps come in quick succession", async () => {
    render(<Harness />);

    fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));
    fireEvent.press(screen.getByRole("button", { name: "내 폴더 펼치기" }));
    fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));
    measureOpening("new", 48);
    await finishMotion();

    expect(screen.getByRole("button", { name: "새 폴더 접기", expanded: true })).toBeTruthy();
    expect(screen.queryByLabelText("내 폴더 목록", HIDDEN)).toBeNull();
    expect(screen.getByRole("radio", { name: "읽을거리" })).toBeTruthy();
  });

  it("cancels the pending motion start when it unmounts mid-switch", () => {
    const frames = new Map<number, FrameRequestCallback>();
    const request = jest.spyOn(global, "requestAnimationFrame").mockImplementation((callback) => {
      const id = frames.size + 1;
      frames.set(id, callback);
      return id;
    });
    const cancel = jest.spyOn(global, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
    try {
      const view = render(<Harness />);
      fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));
      measureOpening("new", 48);
      const started = [...frames.keys()];
      expect(started.length).toBeGreaterThan(0);

      view.unmount();

      for (const id of started) {
        expect(cancel).toHaveBeenCalledWith(id);
      }
      expect(frames.size).toBe(0);
    } finally {
      request.mockRestore();
      cancel.mockRestore();
    }
  });

  it("switches at once with reduced motion", () => {
    mockReducedMotion = true;
    render(<Harness />);

    fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));

    expect(screen.queryByLabelText("내 폴더 목록", HIDDEN)).toBeNull();
    expect(screen.getByRole("radio", { name: "읽을거리" })).toBeTruthy();
  });

  it("shows the open section without a collapsing list on the first render and when the list stops being deferred", () => {
    const { rerender } = render(<Harness isListDeferred />);
    expect(screen.queryByLabelText(/폴더 목록$/, HIDDEN)).toBeNull();

    rerender(<Harness />);

    expect(screen.getByRole("radio", { name: "여행" })).toBeTruthy();
    expect(screen.getAllByLabelText(/폴더 목록$/, HIDDEN)).toHaveLength(1);
  });

  it("renders the rows of a collapsing list for their own section", () => {
    render(
      <Harness renderSectionRow={(row, section) => <Text>{`${section}:${row.name}`}</Text>} />,
    );

    fireEvent.press(screen.getByRole("button", { name: "새 폴더 펼치기" }));

    expect(screen.getByText("existing:여행", HIDDEN)).toBeTruthy();
    expect(screen.getByText("new:읽을거리")).toBeTruthy();
  });
});
