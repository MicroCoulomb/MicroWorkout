import { describe, expect, it } from "vitest";
import { planRemovalMode, resolvePlanOperation } from "./sync-policy";

describe("plan sync policy", () => {
  it("hard-deletes unused plans and archives referenced plans", () => {
    expect(planRemovalMode(false)).toBe("delete");
    expect(planRemovalMode(true)).toBe("archive");
  });

  it("does not allow a stale offline update to restore a deleted plan", () => {
    expect(resolvePlanOperation("upsert", true)).toBe("delete");
    expect(resolvePlanOperation("upsert", false)).toBe("upsert");
    expect(resolvePlanOperation("delete", false)).toBe("delete");
  });
});
