import { validateReturnDestination } from "./return-destination";

describe("validateReturnDestination", () => {
  it.each([
    ["https://elsewhere.test/home", null],
    ["//elsewhere.test/home", null],
    ["/\\elsewhere.test", null],
    ["/folders/../home", null],
    ["/folders/%2fhome", null],
    ["/folders/1\n", null],
    ["/folders/9007199254740992", null],
    ["/unknown", null],
    ["/login?linkId=7", null],
    ["/app", null],
    ["/agreements", null],
    ["/invite?token=secret", null],
    ["/privacy", null],
    ["/public/folders/123", null],
    ["/folders/0?linkId=7&code=abc", "/folders/0?linkId=7"],
    ["/folders/3?linkId=0&unapproved=1", "/folders/3"],
    ["/folders/3?linkId=9007199254740992", "/folders/3"],
    ["/links?linkId=9&linkId=10", "/links?linkId=9"],
    [
      "/home?linkUrl=https%3A%2F%2Fexample.com%2F%3Fx%3D1",
      "/home?linkUrl=https%3A%2F%2Fexample.com%2F%3Fx%3D1",
    ],
    ["/home?linkUrl=javascript%3Aalert%281%29", "/home"],
    ["/links/7?linkId=%2Flogin", "/links/7"],
    ["/settings/imports/2", "/settings/imports/2"],
    ["/qr-scan/?linkId=7", "/qr-scan"],
  ])("validates %s", (value, expected) => {
    expect(validateReturnDestination(value)).toBe(expected);
  });
});
