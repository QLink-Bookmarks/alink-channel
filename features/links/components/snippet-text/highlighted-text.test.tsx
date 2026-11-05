import { render, screen } from "@testing-library/react-native";

import { HighlightedText } from "./highlighted-text";

describe("HighlightedText", () => {
  it("highlights every case-insensitive match of the trimmed query", () => {
    render(
      <HighlightedText
        query="  react "
        testID="title"
        text="React Query와 react hooks"
      />,
    );
    expect(screen.getByTestId("title")).toHaveTextContent("React Query와 react hooks");
    expect(screen.getByText("React")).toBeOnTheScreen();
    expect(screen.getByText("react")).toBeOnTheScreen();
  });

  it("renders plain text without a query", () => {
    render(
      <HighlightedText
        query="   "
        testID="title"
        text="제주 여행"
      />,
    );
    expect(screen.getByTestId("title")).toHaveTextContent("제주 여행");
    expect(screen.getByTestId("title").children).toEqual(["제주 여행"]);
  });

  it("renders plain text when nothing matches", () => {
    render(
      <HighlightedText
        query="부산"
        testID="title"
        text="제주 여행"
      />,
    );
    expect(screen.queryByText("부산")).toBeNull();
    expect(screen.getByTestId("title")).toHaveTextContent("제주 여행");
  });
});
