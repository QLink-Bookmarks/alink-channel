import { mapTodoCounts } from "@/features/home/lib/link-card-mapper";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { LinkCard } from "./link-card";

function renderCard(overrides: Partial<React.ComponentProps<typeof LinkCard>> = {}) {
  const onPress = jest.fn();
  const onImagePress = jest.fn();
  render(
    <LinkCard
      domain="velog.io"
      tags={["React Query", "#프론트엔드"]}
      thumbnailUrl="https://cdn.example/dev-preview-1.png"
      title="TanStack Query v5 마이그레이션 정리"
      todoCounts={mapTodoCounts({ open: 1, dueSoon: 1, overdue: 0, completed: 0 })}
      onImagePress={onImagePress}
      onPress={onPress}
      {...overrides}
    />,
  );
  return { onImagePress, onPress };
}

// The tooltip pulls in Reanimated, whose native part does not exist under Jest.
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

describe("LinkCard", () => {
  it("opens the original from the image cell and the detail from the rest", () => {
    const { onImagePress, onPress } = renderCard();

    fireEvent.press(screen.getByLabelText("원본 열기, velog.io"));
    expect(onImagePress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("TanStack Query v5 마이그레이션 정리"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onImagePress).toHaveBeenCalledTimes(1);
  });

  it("opens the original from the fallback cell of a link without an image", () => {
    const { onImagePress } = renderCard({ thumbnailUrl: null, domain: "ohou.se" });
    fireEvent.press(screen.getByLabelText("원본 열기, ohou.se"));
    expect(onImagePress).toHaveBeenCalledTimes(1);
  });

  it("shows tags with a single # and the AI status, without the summary model", () => {
    renderCard({ statusLabel: "AI 생성 중...", statusVariant: "progress" });
    expect(screen.getByText("#React Query")).toBeOnTheScreen();
    expect(screen.getByText("#프론트엔드")).toBeOnTheScreen();
    expect(screen.getByText("AI 생성 중...")).toBeOnTheScreen();
    expect(screen.queryByText(/요약 모델/)).toBeNull();
  });

  it("shows the todo counts", () => {
    renderCard();
    expect(screen.getByLabelText("임박 1개")).toBeOnTheScreen();
  });

  it("hides the todo counts when the link has no todos", () => {
    renderCard({ todoCounts: null });
    expect(screen.queryByTestId("todo-count-badge")).toBeNull();
  });

  it("has no excerpt line when the link has no excerpt", () => {
    renderCard();
    expect(screen.queryByTestId("link-card-excerpt")).toBeNull();
    expect(screen.queryByTestId("link-card-snippet")).toBeNull();
  });

  it("shows the excerpt in one line without a label", () => {
    renderCard({ excerpt: "TanStack Query v5는 콜백을 없애고 cacheTime을 gcTime으로 바꿨다…" });
    const line = screen.getByTestId("link-card-excerpt");
    expect(line).toHaveTextContent(
      "TanStack Query v5는 콜백을 없애고 cacheTime을 gcTime으로 바꿨다…",
    );
    expect(line.props.numberOfLines).toBe(1);
    // The rest of the card is unchanged.
    expect(screen.getByText("#React Query")).toBeOnTheScreen();
    expect(screen.getByLabelText("임박 1개")).toBeOnTheScreen();
  });

  it("shows the search context in place of the excerpt, two lines, match on its own", () => {
    renderCard({
      excerpt: "본문 앞부분…",
      snippet: { text: "…공항에서 성산일출봉으로 이동…", highlights: [{ start: 6, end: 11 }] },
    });
    expect(screen.queryByTestId("link-card-excerpt")).toBeNull();
    const context = screen.getByTestId("link-card-snippet");
    expect(context).toHaveTextContent("…공항에서 성산일출봉으로 이동…");
    expect(context.props.numberOfLines).toBe(2);
    expect(screen.getByText("성산일출봉")).toBeOnTheScreen();
  });

  it("highlights the query in the title while searching", () => {
    const { onPress } = renderCard({ highlightQuery: "query" });
    expect(screen.getByTestId("link-card-title")).toHaveTextContent(
      "TanStack Query v5 마이그레이션 정리",
    );
    expect(screen.getByText("Query")).toBeOnTheScreen();
    // Opening the detail still works from the title.
    fireEvent.press(screen.getByText("Query"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
