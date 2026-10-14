import { describe, expect, test } from "bun:test";
import {
  LinkError,
  decodeDestination,
  normalizeDestination,
  reservedReason,
  validateSlug,
} from "./links";

describe("validateSlug", () => {
  test("trims whitespace and surrounding slashes", () => {
    expect(validateSlug("  /summer/ ")).toBe("summer");
  });

  test("allows nested slugs", () => {
    expect(validateSlug("spring-term/apply")).toBe("spring-term/apply");
  });

  test.each(["", "has space", "what?", "a#b", "100%", "back\\slash"])("rejects %p", (slug) => {
    expect(() => validateSlug(slug)).toThrow(LinkError);
  });

  test("rejects slugs a built-in route would shadow", () => {
    expect(() => validateSlug("ping")).toThrow(LinkError);
    expect(() => validateSlug("gh/sprig")).toThrow(LinkError);
    expect(reservedReason("GH/sprig")).not.toBeNull();
    expect(reservedReason("ghost")).toBeNull();
  });
});

describe("normalizeDestination", () => {
  test("adds https to bare domains", () => {
    expect(normalizeDestination("hackclub.com/arcade")).toBe("https://hackclub.com/arcade");
  });

  test("strips formatting Slack adds around pasted URLs", () => {
    expect(normalizeDestination("<https://hackclub.com>")).toBe("https://hackclub.com");
    expect(normalizeDestination("*https://hackclub.com*")).toBe("https://hackclub.com");
  });

  test.each([
    "javascript:alert(1)",
    "ftp://files.hackclub.com",
    "data:text/html,hi",
    "https://nodomain",
    "",
  ])("rejects %p", (url) => {
    expect(() => normalizeDestination(url)).toThrow(LinkError);
  });
});

describe("decodeDestination", () => {
  test("decodes rows the old shorten command stored URL-encoded", () => {
    expect(decodeDestination("https%3A%2F%2Fhackclub.com%2Fsummer")).toBe(
      "https://hackclub.com/summer",
    );
  });

  test("leaves malformed encodings alone", () => {
    expect(decodeDestination("https://hackclub.com/100%")).toBe("https://hackclub.com/100%");
  });
});
