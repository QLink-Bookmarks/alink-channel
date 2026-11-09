import { useAuthStore } from "./auth";
import { useListMemoryStore } from "./list-memory";

describe("useListMemoryStore", () => {
  beforeEach(() => {
    useListMemoryStore.getState().clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null });
  });

  it("remembers positions and filters per key", () => {
    const store = useListMemoryStore.getState();
    store.savePosition("/home::mobile", 640);
    store.savePosition("/todos::mobile", 120);
    store.saveFilter("/todos::mobile::filter", "incomplete");

    const state = useListMemoryStore.getState();
    expect(state.positions).toEqual({ "/home::mobile": 640, "/todos::mobile": 120 });
    expect(state.filters["/todos::mobile::filter"]).toBe("incomplete");
  });

  it("forgets everything on logout", () => {
    useAuthStore.setState({ accessToken: "token", refreshToken: "refresh" });
    useListMemoryStore.getState().savePosition("/home::mobile", 640);
    useListMemoryStore.getState().saveFilter("/links::wide::order", "oldest");

    useAuthStore.getState().signOut();

    expect(useListMemoryStore.getState().positions).toEqual({});
    expect(useListMemoryStore.getState().filters).toEqual({});
  });

  it("forgets everything when a refresh-token-only session ends", () => {
    useAuthStore.setState({ accessToken: null, refreshToken: "refresh" });
    useListMemoryStore.getState().savePosition("/home::mobile", 640);

    useAuthStore.getState().signOut();

    expect(useListMemoryStore.getState().positions).toEqual({});
  });

  it("keeps memory while only the access token is cleared", () => {
    useAuthStore.setState({ accessToken: "token", refreshToken: "refresh" });
    useListMemoryStore.getState().savePosition("/home::mobile", 640);

    useAuthStore.getState().setAccessToken(null);

    expect(useListMemoryStore.getState().positions["/home::mobile"]).toBe(640);
  });

  it("keeps memory when the token is refreshed", () => {
    useAuthStore.setState({ accessToken: "token", refreshToken: "refresh" });
    useListMemoryStore.getState().savePosition("/home::mobile", 640);

    useAuthStore.getState().setAccessToken("next-token");

    expect(useListMemoryStore.getState().positions["/home::mobile"]).toBe(640);
  });
});
