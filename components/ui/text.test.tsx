import { Text } from "@/components/ui/text";
import { render, screen } from "@testing-library/react-native";

describe("Text", () => {
  it("renders its children", () => {
    render(<Text>안녕하세요</Text>);

    expect(screen.getByText("안녕하세요")).toBeOnTheScreen();
  });

  it("exposes heading variants as headings", () => {
    render(<Text variant="h1">채널</Text>);

    expect(screen.getByRole("heading", { name: "채널" })).toBeOnTheScreen();
  });
});
