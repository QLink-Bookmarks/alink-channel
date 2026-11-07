import type { TodoListItem } from "../types";

function formatReminderLabel(
  reminderAt?: string | null,
  options?: { withOverdueSuffix?: boolean },
): string | null {
  if (!reminderAt) {
    return null;
  }
  const date = new Date(reminderAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const base = `${month}/${day} ${hours}:${minutes}`;
  const overdue = options?.withOverdueSuffix && date.getTime() < Date.now();
  return overdue ? `${base} (지남)` : base;
}

function groupTodosByLink(
  todos: TodoListItem[],
): { linkId: number; linkTitle: string; linkUrl: string; todos: TodoListItem[] }[] {
  const map = new Map<
    number,
    { linkId: number; linkTitle: string; linkUrl: string; todos: TodoListItem[] }
  >();
  for (const todo of todos) {
    const existing = map.get(todo.linkId);
    if (existing) {
      existing.todos.push(todo);
    } else {
      map.set(todo.linkId, {
        linkId: todo.linkId,
        linkTitle: todo.linkTitle,
        linkUrl: todo.linkUrl,
        todos: [todo],
      });
    }
  }
  return Array.from(map.values());
}

export { formatReminderLabel, groupTodosByLink };
