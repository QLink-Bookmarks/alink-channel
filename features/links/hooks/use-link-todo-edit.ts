import * as React from "react";

import { type DateValue } from "@/components/ui/date-picker";
import { type TimeValue } from "@/components/ui/time-picker";
import type { TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";
import type {
  TodoEditorId,
  TodoEditorMode,
  WeekdayValue,
} from "@/features/todos/components/todo-editor/todo-editor";
import {
  TITLE_REQUIRED_ERROR,
  countTodoDraftErrors,
  validateTodoDrafts,
} from "@/features/todos/lib/todo-schedule";
import {
  useCreateTodoMutation,
  useDeleteTodoMutation,
  useToggleTodoCompletedMutation,
  useUpdateTodoMutation,
} from "@/features/todos/mutations";
import { reportError } from "@/lib/error-reporting";
import { useQueryClient } from "@tanstack/react-query";

import {
  type LinkTodoSaveStep,
  applySavedStep,
  buildSavedTodoDrafts,
  createEmptyTodoDraft,
  hasUnsavedTodoChanges,
  isTodoDraftChanged,
  planTodoSave,
} from "../lib/link-todo-save-plan";
import { getLinkDetailQueryKey } from "../queries";
import type { LinkDetail, LinkTodo } from "../types";

type LinkTodoEditMode = "view" | "edit";

type DraftPatch = Partial<Omit<TodoDraftEditorItem, "id">>;

const LINK_LISTS_QUERY_KEY = ["links", "list"] as const;

// A saved action that lost its title is refused like a new one: an action needs a title.
function requireSavedTitles(
  drafts: TodoDraftEditorItem[],
  saved: TodoDraftEditorItem[],
): TodoDraftEditorItem[] {
  const savedIds = new Set(saved.map((todo) => String(todo.id)));
  return drafts.map((draft) =>
    savedIds.has(String(draft.id)) && !draft.title.trim() && !draft.titleError
      ? { ...draft, titleError: TITLE_REQUIRED_ERROR }
      : draft,
  );
}

/**
 * The 액션 row of one link detail: tapping a card or `+ 추가` edits the actions in place,
 * `저장` checks every row first and then sends only what changed, one request at a time,
 * so a retry after a failed request does not send the done ones again.
 */
function useLinkTodoEdit({ linkId, todos }: { linkId: number; todos: LinkTodo[] }) {
  const queryClient = useQueryClient();
  const createTodoMutation = useCreateTodoMutation();
  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
  const toggleTodoCompletedMutation = useToggleTodoCompletedMutation();
  const [mode, setMode] = React.useState<LinkTodoEditMode>("view");
  const [drafts, setDrafts] = React.useState<TodoDraftEditorItem[]>([]);
  const [openTodoId, setOpenTodoId] = React.useState<TodoEditorId | null>(null);
  const [focusTodoId, setFocusTodoId] = React.useState<TodoEditorId | null>(null);
  const [saveFailed, setSaveFailed] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const savedRef = React.useRef<TodoDraftEditorItem[]>([]);
  // The saved actions as editing started, for telling unsaved changes apart.
  const [editStartSaved, setEditStartSaved] = React.useState<TodoDraftEditorItem[]>([]);
  const draftsRef = React.useRef(drafts);
  const isSavingRef = React.useRef(false);
  const pendingDoneIdsRef = React.useRef(new Set<string>());
  const todosRef = React.useRef(todos);

  React.useLayoutEffect(() => {
    draftsRef.current = drafts;
    todosRef.current = todos;
  });

  const patchDraft = React.useCallback((todoId: TodoEditorId, patch: DraftPatch) => {
    setSaveFailed(false);
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== todoId) return draft;
        const next = { ...draft, ...patch };
        const saved = savedRef.current.find((todo) => todo.id === todoId);
        return { ...next, allowPast: saved ? !isTodoDraftChanged(saved, next) : false };
      }),
    );
  }, []);

  const startEdit = React.useCallback((todoId: TodoEditorId) => {
    // A done toggle still on its way could roll back under the editor's snapshot.
    if (isSavingRef.current || pendingDoneIdsRef.current.has(String(todoId))) return;
    const saved = buildSavedTodoDrafts(todosRef.current);
    savedRef.current = saved;
    setEditStartSaved(saved);
    setDrafts(saved);
    setOpenTodoId(todoId);
    setFocusTodoId(todoId);
    setSaveFailed(false);
    setMode("edit");
  }, []);

  const addRow = React.useCallback(() => {
    if (isSavingRef.current) return;
    const empty = createEmptyTodoDraft();
    setSaveFailed(false);
    setDrafts((current) => [...current, empty]);
    setFocusTodoId(empty.id);
  }, []);

  const startAdd = React.useCallback(() => {
    if (isSavingRef.current) return;
    if (mode === "edit") {
      addRow();
      return;
    }
    const saved = buildSavedTodoDrafts(todosRef.current);
    const empty = createEmptyTodoDraft();
    savedRef.current = saved;
    setEditStartSaved(saved);
    setDrafts([...saved, empty]);
    setOpenTodoId(null);
    setFocusTodoId(empty.id);
    setSaveFailed(false);
    setMode("edit");
  }, [addRow, mode]);

  const cancel = React.useCallback(() => {
    if (isSavingRef.current) return;
    setMode("view");
    setDrafts([]);
    setOpenTodoId(null);
    setFocusTodoId(null);
    setSaveFailed(false);
  }, []);

  const handleChangeTitle = React.useCallback(
    (todoId: TodoEditorId, title: string) => patchDraft(todoId, { title, titleError: null }),
    [patchDraft],
  );
  const handleChangeMode = React.useCallback(
    (todoId: TodoEditorId, nextMode: TodoEditorMode) =>
      patchDraft(todoId, { mode: nextMode, validationError: null, titleError: null }),
    [patchDraft],
  );
  const handleChangeWeekdays = React.useCallback(
    (todoId: TodoEditorId, selectedWeekdays: WeekdayValue[]) =>
      patchDraft(todoId, { selectedWeekdays, validationError: null }),
    [patchDraft],
  );
  const handleChangeDate = React.useCallback(
    (todoId: TodoEditorId, date: DateValue) => patchDraft(todoId, { date, validationError: null }),
    [patchDraft],
  );
  const handleChangeTime = React.useCallback(
    (todoId: TodoEditorId, time: TimeValue) => patchDraft(todoId, { time, validationError: null }),
    [patchDraft],
  );
  const handleChangeDone = React.useCallback(
    (todoId: TodoEditorId, done: boolean) => patchDraft(todoId, { done, validationError: null }),
    [patchDraft],
  );
  const handleRemove = React.useCallback((todoId: TodoEditorId) => {
    setSaveFailed(false);
    setDrafts((current) => current.filter((draft) => draft.id !== todoId));
  }, []);

  const runStep = React.useCallback(
    async (step: LinkTodoSaveStep): Promise<TodoEditorId | undefined> => {
      switch (step.kind) {
        case "delete":
          await deleteTodoMutation.mutateAsync(step.todoId);
          return undefined;
        case "update":
          await updateTodoMutation.mutateAsync({ payload: step.payload, todoId: step.todoId });
          return undefined;
        case "complete":
          await toggleTodoCompletedMutation.mutateAsync({
            payload: { isCompleted: step.isCompleted },
            todoId: step.todoId,
          });
          return undefined;
        case "create": {
          const response = await createTodoMutation.mutateAsync(step.payload);
          return response.data.id;
        }
      }
    },
    [createTodoMutation, deleteTodoMutation, toggleTodoCompletedMutation, updateTodoMutation],
  );

  // Resolves true once every change is saved (or there was none), false when a check or a
  // request stopped it.
  const save = React.useCallback(async (): Promise<boolean> => {
    if (isSavingRef.current) return false;

    const checked = validateTodoDrafts(draftsRef.current);
    let current = requireSavedTitles(checked.todos, savedRef.current);
    if (current.some((draft) => draft.titleError || draft.validationError)) {
      setSaveFailed(false);
      setDrafts(current);
      return false;
    }
    setDrafts(current);

    const steps = planTodoSave(savedRef.current, current, linkId);
    if (steps.length === 0) {
      cancel();
      return true;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveFailed(false);
    let saved = savedRef.current;
    let failed = false;
    try {
      for (const step of steps) {
        const createdId = await runStep(step);
        saved = applySavedStep(saved, current, step, createdId);
        savedRef.current = saved;
        if (step.kind !== "create" || createdId == null) continue;

        // The created row is a saved action from now on, under its server id.
        const draftId = step.draftId;
        current = current.map((draft) =>
          draft.id === draftId ? { ...draft, id: createdId, allowPast: true } : draft,
        );
        setDrafts(current);
        setOpenTodoId((openId) => (openId === draftId ? createdId : openId));
        setFocusTodoId((focusId) => (focusId === draftId ? null : focusId));
        if (step.isCompleted) {
          const completeStep: LinkTodoSaveStep = {
            kind: "complete",
            todoId: createdId,
            isCompleted: true,
          };
          await runStep(completeStep);
          saved = applySavedStep(saved, current, completeStep);
          savedRef.current = saved;
        }
      }
    } catch (error: unknown) {
      failed = true;
      reportError(error, { area: "link-detail-view:save-todos", extra: { linkId } });
    }

    // Some requests may have gone through even when a later one failed.
    await queryClient.invalidateQueries({ queryKey: getLinkDetailQueryKey(linkId) });
    void queryClient.invalidateQueries({ queryKey: LINK_LISTS_QUERY_KEY });
    isSavingRef.current = false;
    setIsSaving(false);
    if (failed) {
      setSaveFailed(true);
      return false;
    }
    setMode("view");
    setDrafts([]);
    setOpenTodoId(null);
    setFocusTodoId(null);
    return true;
  }, [cancel, linkId, queryClient, runStep]);

  // The view card's checkbox saves right away and shows the new state before the answer.
  const toggleDone = React.useCallback(
    async (todoId: TodoEditorId, checked: boolean) => {
      const todoKey = String(todoId);
      if (pendingDoneIdsRef.current.has(todoKey)) return;
      pendingDoneIdsRef.current.add(todoKey);

      const queryKey = getLinkDetailQueryKey(linkId);
      const previousDetail = queryClient.getQueryData<LinkDetail>(queryKey);
      const setDone = (completedAt: string | null) =>
        queryClient.setQueryData<LinkDetail>(queryKey, (detail) =>
          detail
            ? {
                ...detail,
                todos: (detail.todos ?? []).map((todo) =>
                  String(todo.id) === todoKey
                    ? { ...todo, completed: checked, completedAt, done: checked }
                    : todo,
                ),
              }
            : detail,
        );

      setDone(checked ? new Date().toISOString() : null);
      try {
        const response = await toggleTodoCompletedMutation.mutateAsync({
          payload: { isCompleted: checked },
          todoId,
        });
        setDone(checked ? (response.data?.completeAt ?? null) : null);
        await queryClient.invalidateQueries({ queryKey });
        void queryClient.invalidateQueries({ queryKey: LINK_LISTS_QUERY_KEY });
      } catch (error: unknown) {
        if (previousDetail) queryClient.setQueryData(queryKey, previousDetail);
        reportError(error, {
          area: "link-detail-view:toggle-todo-completed",
          extra: { isCompleted: checked, linkId, todoId },
        });
      } finally {
        pendingDoneIdsRef.current.delete(todoKey);
      }
    },
    [linkId, queryClient, toggleTodoCompletedMutation],
  );

  return {
    mode,
    drafts,
    openTodoId,
    focusTodoId,
    saveFailed,
    isSaving,
    errorCount: countTodoDraftErrors(drafts),
    isDirty: mode === "edit" && hasUnsavedTodoChanges(editStartSaved, drafts),
    startEdit,
    startAdd,
    cancel,
    save,
    toggleDone,
    setOpenTodoId,
    handleChangeTitle,
    handleChangeMode,
    handleChangeWeekdays,
    handleChangeDate,
    handleChangeTime,
    handleChangeDone,
    handleRemove,
  };
}

export { useLinkTodoEdit };
export type { LinkTodoEditMode };
