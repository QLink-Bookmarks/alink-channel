import { openLinkUrl } from "@/features/links/lib/open-link-url";
import { render, screen, userEvent } from "@testing-library/react-native";

import { ExcerptContinueLink } from "./excerpt-continue-link";

jest.mock("@/features/links/lib/open-link-url", () => ({ openLinkUrl: jest.fn() }));

const URL_TO_OPEN = "https://brunch.co.kr/@jeju/east-3days";

describe("ExcerptContinueLink (native)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("opens the original on a short press", async () => {
    const user = userEvent.setup();
    render(<ExcerptContinueLink url={URL_TO_OPEN} />);
    await user.press(screen.getByRole("link", { name: "이어 읽기" }));
    expect(openLinkUrl).toHaveBeenCalledWith(URL_TO_OPEN);
  });

  it("opens nothing when held and released", async () => {
    const user = userEvent.setup();
    render(<ExcerptContinueLink url={URL_TO_OPEN} />);
    await user.longPress(screen.getByRole("link", { name: "이어 읽기" }), { duration: 1000 });
    expect(openLinkUrl).not.toHaveBeenCalled();
  });
});
