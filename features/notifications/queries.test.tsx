import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { getNotifications } from "./api";
import { notificationQueryKeys, useNotificationsQuery } from "./queries";
import type { GetNotificationsParams } from "./types";

jest.mock("./api", () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
}));

const fetchNotifications = getNotifications as jest.MockedFunction<typeof getNotifications>;

const emptyPage = { isEmpty: true, contents: [], nextCursor: null, hasNext: false };

function renderNotificationsHook(params?: GetNotificationsParams) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useNotificationsQuery(params), { wrapper });
  return { ...rendered, client };
}

describe("useNotificationsQuery", () => {
  beforeEach(() => {
    fetchNotifications.mockReset();
    fetchNotifications.mockResolvedValue({ success: true, data: emptyPage, error: null });
  });

  it("asks for the most recently received notifications first", async () => {
    const { result, client } = renderNotificationsHook();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = { orderKey: "fired_at", order: "desc", size: 30 } as const;
    expect(fetchNotifications).toHaveBeenCalledWith(params);
    expect(client.getQueryData(notificationQueryKeys.list(params))).toBe(result.current.data);
  });

  it("keeps the received order when a type filter is given", async () => {
    const { result } = renderNotificationsHook({ size: 30, type: "TODO" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchNotifications).toHaveBeenCalledWith({
      orderKey: "fired_at",
      order: "desc",
      size: 30,
      type: "TODO",
    });
  });
});
