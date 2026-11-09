import type * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";

import type { ImportSummary } from "../types";
import {
  hasFinishedImportProgress,
  toProgressSnapshot,
  useImportProgressRefresh,
} from "./use-import-progress-refresh";

function summary(id: number, progress: number): ImportSummary {
  return {
    id,
    fileName: `bookmarks_${id}.html`,
    status: "COMPLETED",
    linkCount: 1,
    folderCount: 0,
    skippedCount: 0,
    failedCount: 0,
    progress,
    isReversible: true,
    createdAt: "2026-11-03T00:00:00.000Z",
  };
}

describe("hasFinishedImportProgress", () => {
  it("is true when a row goes from below 1 to 1", () => {
    const previous = toProgressSnapshot([summary(1, 0.5), summary(2, 1)]);
    expect(hasFinishedImportProgress(previous, [summary(1, 1), summary(2, 1)])).toBe(true);
  });

  it("is false while rows are still filling or were already done", () => {
    const previous = toProgressSnapshot([summary(1, 0.2), summary(2, 1)]);
    expect(hasFinishedImportProgress(previous, [summary(1, 0.6), summary(2, 1)])).toBe(false);
  });

  it("ignores rows seen for the first time", () => {
    expect(hasFinishedImportProgress(new Map(), [summary(3, 1)])).toBe(false);
  });
});

describe("useImportProgressRefresh", () => {
  const clients: QueryClient[] = [];

  afterEach(() => {
    clients.splice(0).forEach((client) => client.clear());
  });

  function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    clients.push(client);
    const spy = jest.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const view = renderHook(
      ({ rows }: { rows: ImportSummary[] | undefined }) => useImportProgressRefresh(rows),
      { initialProps: { rows: undefined as ImportSummary[] | undefined }, wrapper },
    );
    return { spy, view };
  }

  it("invalidates links once when a row finishes filling thumbnails", () => {
    const { spy, view } = setup();

    view.rerender({ rows: [summary(1, 0.5)] });
    expect(spy).not.toHaveBeenCalled();

    view.rerender({ rows: [summary(1, 1)] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["links"] });

    view.rerender({ rows: [summary(1, 1)] });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does nothing for rows that load already finished", () => {
    const { spy, view } = setup();
    view.rerender({ rows: [summary(1, 1), summary(2, 1)] });
    expect(spy).not.toHaveBeenCalled();
  });
});
