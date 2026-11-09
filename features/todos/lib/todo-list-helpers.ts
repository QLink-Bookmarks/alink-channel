import type { TodoListItem } from "../types";

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

export { groupTodosByLink };
