import type { TodoListItem } from "../types";
import {
  applyToggleToCounts,
  deriveTodoStatus,
  getDefaultTodoSort,
  getTodoAppliedLabel,
  getTodoPill,
  getTodoSortCriteria,
  groupTodosByStatus,
  isDefaultTodoSort,
  isInStatusFilter,
  readTodoSort,
  readTodoStatusFilter,
  resolveTodoSortOnStatusChange,
  toTodoListParams,
} from "./todo-status";

const NOW = new Date("2026-11-07T12:00:00Z").getTime();
const PAST = "2026-11-06T09:00:00Z";
const FUTURE = "2026-11-08T09:00:00Z";

function todo(id: number, overrides: Partial<TodoListItem> = {}): TodoListItem {
  return {
    id,
    title: `액션 ${id}`,
    status: "ACTIVE",
    createdAt: "2026-11-01T00:00:00Z",
    linkId: 1,
    linkUrl: "https://example.com",
    linkTitle: "링크",
    linkThumbnailUrl: null,
    linkFaviconUrl: null,
    ...overrides,
  };
}

describe("getTodoSortCriteria", () => {
  it("shows 완료일 only under 완료", () => {
    const keys = (status: Parameters<typeof getTodoSortCriteria>[0]) =>
      getTodoSortCriteria(status).map((criterion) => criterion.key);
    expect(keys("completed")).toEqual(["reminder_at", "created_at", "completed_at"]);
    expect(keys("all")).toEqual(["reminder_at", "created_at"]);
    expect(keys("active")).toEqual(["reminder_at", "created_at"]);
    expect(keys("overdue")).toEqual(["reminder_at", "created_at"]);
  });

  it("starts 알림일 soonest first, 만든 날 and 완료일 newest first", () => {
    expect(
      getTodoSortCriteria("completed").map((criterion) => [
        criterion.label,
        criterion.firstDirection,
      ]),
    ).toEqual([
      ["알림일", "asc"],
      ["만든 날", "desc"],
      ["완료일", "desc"],
    ]);
  });
});

describe("getDefaultTodoSort", () => {
  it("is 완료일 ↓ under 완료 and 알림일 ↑ elsewhere", () => {
    expect(getDefaultTodoSort("completed")).toEqual({ key: "completed_at", direction: "desc" });
    expect(getDefaultTodoSort("all")).toEqual({ key: "reminder_at", direction: "asc" });
    expect(getDefaultTodoSort("active")).toEqual({ key: "reminder_at", direction: "asc" });
  });

  it("is the default of its own status only", () => {
    expect(isDefaultTodoSort("completed", { key: "completed_at", direction: "desc" })).toBe(true);
    expect(isDefaultTodoSort("active", { key: "reminder_at", direction: "asc" })).toBe(true);
    expect(isDefaultTodoSort("completed", { key: "reminder_at", direction: "asc" })).toBe(false);
    expect(isDefaultTodoSort("all", { key: "reminder_at", direction: "desc" })).toBe(false);
  });
});

describe("resolveTodoSortOnStatusChange", () => {
  it("goes back to 알림일 ↑ when 완료일 is not there", () => {
    expect(
      resolveTodoSortOnStatusChange("completed", "active", {
        key: "completed_at",
        direction: "desc",
      }),
    ).toEqual({ key: "reminder_at", direction: "asc" });
  });

  it("moves a default sort to the new status's default", () => {
    expect(
      resolveTodoSortOnStatusChange("all", "completed", { key: "reminder_at", direction: "asc" }),
    ).toEqual({ key: "completed_at", direction: "desc" });
    expect(
      resolveTodoSortOnStatusChange("completed", "all", { key: "completed_at", direction: "desc" }),
    ).toEqual({ key: "reminder_at", direction: "asc" });
  });

  it("keeps a chosen criterion the new status has, with its direction", () => {
    expect(
      resolveTodoSortOnStatusChange("all", "overdue", { key: "created_at", direction: "desc" }),
    ).toEqual({ key: "created_at", direction: "desc" });
    expect(
      resolveTodoSortOnStatusChange("all", "completed", { key: "reminder_at", direction: "desc" }),
    ).toEqual({ key: "reminder_at", direction: "desc" });
  });
});

describe("toTodoListParams", () => {
  it("leaves status out for 전체", () => {
    expect(toTodoListParams("all", { key: "reminder_at", direction: "asc" })).toEqual({
      orderKey: "reminder_at",
      order: "asc",
    });
  });

  it("sends the status and the sort", () => {
    expect(toTodoListParams("completed", { key: "completed_at", direction: "desc" })).toEqual({
      status: "completed",
      orderKey: "completed_at",
      order: "desc",
    });
  });
});

describe("deriveTodoStatus", () => {
  it("follows the server rule", () => {
    expect(deriveTodoStatus({ completedAt: PAST, reminderAt: PAST }, NOW)).toBe("COMPLETED");
    expect(deriveTodoStatus({ completedAt: null, reminderAt: PAST }, NOW)).toBe("OVERDUE");
    expect(deriveTodoStatus({ completedAt: null, reminderAt: FUTURE }, NOW)).toBe("ACTIVE");
    expect(deriveTodoStatus({ completedAt: null, reminderAt: null }, NOW)).toBe("ACTIVE");
  });
});

describe("groupTodosByStatus", () => {
  it("orders 기간지남 → 진행 중 → 완료 by the server status and drops empty sections", () => {
    const sections = groupTodosByStatus(
      [
        todo(1, { status: "ACTIVE" }),
        todo(2, { status: "COMPLETED", completedAt: PAST }),
        // The server's status wins over the reminder time.
        todo(3, { status: "OVERDUE", reminderAt: FUTURE }),
        todo(4, { status: "ACTIVE" }),
      ],
      NOW,
    );
    expect(sections.map((section) => [section.label, section.todos.map((t) => t.id)])).toEqual([
      ["기간지남", [3]],
      ["진행 중", [1, 4]],
      ["완료", [2]],
    ]);
  });

  it("leaves out sections with no action", () => {
    const sections = groupTodosByStatus([todo(1, { status: "ACTIVE" })], NOW);
    expect(sections.map((section) => section.status)).toEqual(["ACTIVE"]);
  });
});

describe("isInStatusFilter", () => {
  it("keeps everything under 전체 and only the matching status elsewhere", () => {
    expect(isInStatusFilter("COMPLETED", "all")).toBe(true);
    expect(isInStatusFilter("COMPLETED", "active")).toBe(false);
    expect(isInStatusFilter("OVERDUE", "overdue")).toBe(true);
  });
});

describe("applyToggleToCounts", () => {
  const counts = { all: 6, active: 3, overdue: 1, completed: 2 };

  it("moves one action between statuses and keeps 전체", () => {
    expect(applyToggleToCounts(counts, "ACTIVE", "COMPLETED")).toEqual({
      all: 6,
      active: 2,
      overdue: 1,
      completed: 3,
    });
    expect(applyToggleToCounts(counts, "COMPLETED", "OVERDUE")).toEqual({
      all: 6,
      active: 3,
      overdue: 2,
      completed: 1,
    });
  });

  it("changes nothing when the status stays", () => {
    expect(applyToggleToCounts(counts, "ACTIVE", "ACTIVE")).toBe(counts);
  });
});

describe("getTodoPill / getTodoAppliedLabel", () => {
  it("is empty at the status's default", () => {
    expect(getTodoPill("completed", { key: "completed_at", direction: "desc" })).toBeNull();
    expect(getTodoAppliedLabel("active", { key: "reminder_at", direction: "asc" })).toBeNull();
  });

  it("shows the sort otherwise", () => {
    expect(getTodoPill("active", { key: "created_at", direction: "desc" })).toEqual({
      label: "만든 날",
      direction: "desc",
    });
    expect(getTodoAppliedLabel("all", { key: "reminder_at", direction: "desc" })).toBe(
      "알림일 내림차순",
    );
  });
});

describe("readTodoStatusFilter / readTodoSort", () => {
  it("keeps valid remembered values", () => {
    expect(readTodoStatusFilter("overdue")).toBe("overdue");
    expect(readTodoSort({ key: "created_at", direction: "asc" }, "active")).toEqual({
      key: "created_at",
      direction: "asc",
    });
  });

  it("falls back to the defaults", () => {
    expect(readTodoStatusFilter("incomplete")).toBe("all");
    expect(readTodoStatusFilter(undefined)).toBe("all");
    expect(readTodoSort(undefined, "completed")).toEqual({
      key: "completed_at",
      direction: "desc",
    });
    expect(readTodoSort({ key: "completed_at", direction: "desc" }, "active")).toEqual({
      key: "reminder_at",
      direction: "asc",
    });
    expect(readTodoSort({ key: "created_at", direction: "sideways" }, "all")).toEqual({
      key: "reminder_at",
      direction: "asc",
    });
  });
});
