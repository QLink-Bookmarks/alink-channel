import { Text } from "@/components/ui/text";
import { useDisplaySettings } from "@/stores/display-settings";
import { act, render, screen } from "@testing-library/react-native";

import { AiProviderLogo } from "./ai-provider-logo";

describe("AiProviderLogo", () => {
  afterEach(() => {
    act(() => {
      useDisplaySettings.setState((state) => ({ display: { ...state.display, theme: "light" } }));
    });
  });

  it("pairs each provider's mark with its name", () => {
    render(
      <>
        <AiProviderLogo kind="gemini" />
        <AiProviderLogo kind="claude" />
        <AiProviderLogo kind="openai" />
      </>,
    );

    expect(screen.getByText("Gemini")).toBeOnTheScreen();
    expect(screen.getByText("Claude")).toBeOnTheScreen();
    expect(screen.getByText("OpenAI")).toBeOnTheScreen();
    expect(screen.getByTestId("ai-provider-logo-gemini")).toBeOnTheScreen();
    expect(screen.getByTestId("ai-provider-logo-claude")).toBeOnTheScreen();
    expect(screen.getByTestId("ai-provider-logo-openai")).toBeOnTheScreen();
  });

  it("takes a custom name and trailing content on the same line", () => {
    render(
      <AiProviderLogo
        kind="gemini"
        name="Gemini Pro"
      >
        <Text>기본</Text>
      </AiProviderLogo>,
    );

    expect(screen.getByText("Gemini Pro")).toBeOnTheScreen();
    expect(screen.getByText("기본")).toBeOnTheScreen();
    expect(screen.queryByText("Gemini")).toBeNull();
  });

  it("switches the OpenAI mark with the theme", () => {
    const { rerender } = render(<AiProviderLogo kind="openai" />);
    const lightSource = screen.getByTestId("ai-provider-logo-openai").props.source;

    act(() => {
      useDisplaySettings.setState((state) => ({ display: { ...state.display, theme: "dark" } }));
    });
    rerender(<AiProviderLogo kind="openai" />);
    const darkSource = screen.getByTestId("ai-provider-logo-openai").props.source;

    expect(darkSource).not.toEqual(lightSource);
  });
});
