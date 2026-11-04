import * as React from "react";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { type FolderSectionDefinition, FolderSectionsView } from "./folder-sections";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const mock = require("react-native-reanimated/mock");
  return {
    ...mock,
    useReducedMotion: () => true,
    // Shared values that keep their value across renders, as on a device. The stock mock makes
    // a new one from the initial value on every render, which would hide a stale value.
    useSharedValue: (init: unknown) => ReactModule.useRef({ value: init }).current,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

type SectionKey = "mine" | "shared";
type Row = { key: string; name: string };

const SECTIONS: FolderSectionDefinition<SectionKey, Row>[] = [
  { key: "mine", label: "내 폴더", rows: [{ key: "mine:1", name: "여행" }] },
  { key: "shared", label: "공유 폴더", rows: [{ key: "shared:1", name: "읽을거리" }] },
];

function Harness() {
  const [openSection, setOpenSection] = React.useState<SectionKey | null>("shared");
  const handleToggle = React.useCallback(
    (section: SectionKey) => setOpenSection((current) => (current === section ? null : section)),
    [],
  );
  const renderRow = React.useCallback(
    (row: Row) => (
      <Pressable
        accessibilityLabel={row.name}
        accessibilityRole="radio"
      >
        <Text>{row.name}</Text>
      </Pressable>
    ),
    [],
  );
  return (
    <FolderSectionsView
      getRowKey={(row) => row.key}
      openSection={openSection}
      sections={SECTIONS}
      tone="surface"
      renderRow={renderRow}
      onToggle={handleToggle}
    />
  );
}

function bodyMaxHeight(section: SectionKey) {
  const body = screen.getByTestId(`folder-section-body-${section}`, {
    includeHiddenElements: true,
  });
  const styles = [body.props.style].flat(Infinity) as ({ maxHeight?: number } | null)[];
  return Object.assign({}, ...styles.filter(Boolean)).maxHeight as number | undefined;
}

describe("FolderSectionsView with reduced motion", () => {
  it("shows the newly opened section at full height on its first render", () => {
    render(<Harness />);
    expect(bodyMaxHeight("shared")).toBeGreaterThan(0);

    fireEvent.press(screen.getByRole("button", { name: "내 폴더 펼치기" }));

    expect(
      screen.queryByTestId("folder-section-body-shared", { includeHiddenElements: true }),
    ).toBeNull();
    expect(bodyMaxHeight("mine")).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: "여행" })).toBeTruthy();
  });
});
