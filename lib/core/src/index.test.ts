import { describe, it } from "vitest";
import { test } from ".";

describe("index", () => {
  it("Should export stuff", ({ expect }) => {
    expect(test).toBe("Hello World!");
  });
});
