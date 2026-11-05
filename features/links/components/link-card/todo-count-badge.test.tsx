import { mapTodoCounts } from "@/features/home/lib/link-card-mapper";
import { render, screen } from "@testing-library/react-native";

import { TodoCountBadge } from "./todo-count-badge";

function renderBadge(counts: Parameters<typeof mapTodoCounts>[0]) {
  const summary = mapTodoCounts(counts);
  if (!summary) throw new Error("expected todo counts");
  return render(<TodoCountBadge summary={summary} />);
}

// The tooltip pulls in Reanimated, whose native part does not exist under Jest.
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

describe("TodoCountBadge", () => {
  it("shows each kind's count and names them all in the accessible label", () => {
    renderBadge({ open: 4, dueSoon: 1, overdue: 1, completed: 0 });
    expect(screen.getByLabelText("액션 2개, 임박 1개, 기한 지남 1개")).toBeOnTheScreen();
    expect(screen.getByText("2")).toBeOnTheScreen();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("hides kinds with zero todos", () => {
    renderBadge({ open: 3, dueSoon: 0, overdue: 3, completed: 1 });
    const badge = screen.getByLabelText("기한 지남 3개");
    expect(badge).toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows a single check without a number when every todo is done", () => {
    renderBadge({ open: 0, dueSoon: 0, overdue: 0, completed: 5 });
    const badge = screen.getByLabelText("액션 모두 완료");
    expect(badge).toBeOnTheScreen();
    expect(screen.queryByText(/\d/)).toBeNull();
  });
});
