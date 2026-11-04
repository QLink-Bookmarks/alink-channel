import { Text } from "@/components/ui/text";
import { render, screen } from "@testing-library/react-native";

describe("Text", () => {
  it("renders its children", () => {
    render(<Text>안녕하세요</Text>);

    expect(screen.getByText("안녕하세요")).toBeOnTheScreen();
  });

  it("breaks Korean only between words on iOS unless told otherwise", () => {
    render(
      <>
        <Text>남길 항목은 체크를 풀어 주세요.</Text>
        <Text lineBreakStrategyIOS="standard">기본 줄바꿈</Text>
      </>,
    );

    expect(screen.getByText("남길 항목은 체크를 풀어 주세요.")).toHaveProp(
      "lineBreakStrategyIOS",
      "hangul-word",
    );
    expect(screen.getByText("기본 줄바꿈")).toHaveProp("lineBreakStrategyIOS", "standard");
  });

  it("exposes heading variants as headings", () => {
    render(<Text variant="h1">채널</Text>);

    expect(screen.getByRole("heading", { name: "채널" })).toBeOnTheScreen();
  });
});
