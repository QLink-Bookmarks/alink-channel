import { QueryClient } from "@tanstack/react-query";

import { invalidateImportedData } from "./use-invalidate-imported-data";

const clients: QueryClient[] = [];

function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  clients.push(client);
  return client;
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

function invalidatedKeys(client: QueryClient) {
  const spy = jest.spyOn(client, "invalidateQueries");
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe("invalidateImportedData", () => {
  it("invalidates imports, links, folders and search after a start", async () => {
    const client = createClient();
    const keys = invalidatedKeys(client);

    await invalidateImportedData(client);

    expect(keys()).toEqual([["imports"], ["links"], ["folders"], ["search"]]);
  });

  it("also invalidates todo lists after a reversal", async () => {
    const client = createClient();
    const keys = invalidatedKeys(client);

    await invalidateImportedData(client, { includeTodos: true });

    expect(keys()).toEqual([["imports"], ["links"], ["folders"], ["search"], ["todos", "list"]]);
  });

  it("marks cached import detail and reversal preview queries stale", async () => {
    const client = createClient();
    client.setQueryData(["imports", "detail", 1], { id: 1 });
    client.setQueryData(["imports", "reversal-preview", 1], { folders: [] });
    client.setQueryData(["todos", "list", { orderKey: "reminder_at", order: "asc" }], []);

    await invalidateImportedData(client, { includeTodos: true });

    expect(client.getQueryState(["imports", "detail", 1])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["imports", "reversal-preview", 1])?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(["todos", "list", { orderKey: "reminder_at", order: "asc" }])
        ?.isInvalidated,
    ).toBe(true);
  });
});
