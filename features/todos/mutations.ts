import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTodo, deleteTodo, toggleTodoCompleted, updateTodo } from "./api";
import { todoQueryKeys } from "./queries";
import type { CompleteTodoRequest, CreateTodoRequest, UpdateTodoRequest } from "./types";

function useInvalidateTodoLists() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
}

function useCreateTodoMutation() {
  const invalidateTodoLists = useInvalidateTodoLists();
  return useMutation({
    mutationFn: (payload: CreateTodoRequest) => createTodo(payload),
    onSuccess: () => {
      void invalidateTodoLists();
    },
  });
}

function useUpdateTodoMutation() {
  const invalidateTodoLists = useInvalidateTodoLists();
  return useMutation({
    mutationFn: ({ payload, todoId }: { todoId: number | string; payload: UpdateTodoRequest }) =>
      updateTodo(todoId, payload),
    onSuccess: () => {
      void invalidateTodoLists();
    },
  });
}

function useDeleteTodoMutation() {
  const invalidateTodoLists = useInvalidateTodoLists();
  return useMutation({
    mutationFn: (todoId: number | string) => deleteTodo(todoId),
    onSuccess: () => {
      void invalidateTodoLists();
    },
  });
}

function useToggleTodoCompletedMutation() {
  const invalidateTodoLists = useInvalidateTodoLists();
  return useMutation({
    mutationFn: ({ payload, todoId }: { todoId: number | string; payload: CompleteTodoRequest }) =>
      toggleTodoCompleted(todoId, payload),
    onSuccess: () => {
      void invalidateTodoLists();
    },
  });
}

export {
  useCreateTodoMutation,
  useDeleteTodoMutation,
  useToggleTodoCompletedMutation,
  useUpdateTodoMutation,
};
