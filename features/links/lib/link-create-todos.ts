import type { TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";
import { buildScheduleApiFields } from "@/features/todos/lib/todo-schedule";

import type { CreateLinkTodoRequest } from "../types";

// Untitled drafts are left out.
function buildLinkTodoRequests(todos: TodoDraftEditorItem[]): CreateLinkTodoRequest[] {
  return todos
    .filter((todo) => todo.title.trim().length > 0)
    .map((todo) => ({ title: todo.title.trim(), ...buildScheduleApiFields(todo) }));
}

// The memo and actions for an AI 정리 request. Empty ones are left out of the body,
// so a request without them is the same as before the server took them.
function buildAiMemoAndTodoFields(
  memo: string,
  todos: TodoDraftEditorItem[],
): { memo?: string; todos?: CreateLinkTodoRequest[] } {
  const trimmedMemo = memo.trim();
  const todoRequests = buildLinkTodoRequests(todos);
  return {
    ...(trimmedMemo ? { memo: trimmedMemo } : {}),
    ...(todoRequests.length > 0 ? { todos: todoRequests } : {}),
  };
}

export { buildAiMemoAndTodoFields, buildLinkTodoRequests };
