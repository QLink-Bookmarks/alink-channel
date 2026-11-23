import { resourceReadOptions } from "./resource-read";

describe("resourceReadOptions", () => {
  it.each([null, "access-token"])(
    "uses the default API adapter with auth token %s",
    (authToken) => {
      const { signal } = new AbortController();
      const options = resourceReadOptions(authToken, signal);

      expect(options).toEqual({
        authToken,
        signal,
        withCredentials: false,
      });
    },
  );
});
