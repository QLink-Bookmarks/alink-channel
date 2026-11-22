import { api } from "@/lib/api-client";

import type {
  CompleteTodoRequest,
  CompleteTodoResponse,
  CreateTodoRequest,
  CreateTodoResponse,
  DeleteTodoResponse,
  GetTodoCountsResponse,
  GetTodosParams,
  GetTodosResponse,
  UpdateTodoRequest,
  UpdateTodoResponse,
} from "./types";

async function getTodos(params: GetTodosParams = {}) {
  return api.get<GetTodosResponse>("/api/todos", { params });
}

async function getTodoCounts() {
  return api.get<GetTodoCountsResponse>("/api/todos/counts");
}

async function createTodo(payload: CreateTodoRequest) {
  return api.post<CreateTodoResponse, CreateTodoRequest>("/api/todos", payload);
}

async function updateTodo(todoId: number | string, payload: UpdateTodoRequest) {
  return api.put<UpdateTodoResponse, UpdateTodoRequest>(`/api/todos/${todoId}`, payload);
}

async function deleteTodo(todoId: number | string) {
  return api.delete<DeleteTodoResponse>(`/api/todos/${todoId}`);
}

async function toggleTodoCompleted(todoId: number | string, payload: CompleteTodoRequest) {
  return api.put<CompleteTodoResponse, CompleteTodoRequest>(
    `/api/todos/${todoId}/completed`,
    payload,
  );
}

export { createTodo, deleteTodo, getTodoCounts, getTodos, toggleTodoCompleted, updateTodo };
