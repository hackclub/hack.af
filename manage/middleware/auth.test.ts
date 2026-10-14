import { describe, expect, test } from "bun:test";
import { safeReturnTo } from "./auth";

describe("safeReturnTo", () => {
  test("keeps same-origin paths with their query and hash", () => {
    expect(safeReturnTo("/links/summer?range=7#history")).toBe("/links/summer?range=7#history");
  });

  test.each([
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "evil.com",
    "/%0a//evil.com\n",
    "/\tevil",
    "",
    null,
    undefined,
  ])("rejects %p", (value) => {
    expect(safeReturnTo(value)).toBeUndefined();
  });
});
