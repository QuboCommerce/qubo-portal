import { describe, expect, test } from "bun:test";
import { PLANS } from "@qubo-portal/plans";
import { allot } from "./allot";

const growth = PLANS.growth.limits; // 2 orgs, 4 sites, pooled

describe("allot", () => {
  test("first server gets the whole pool", () => {
    expect(allot(growth, [])).toMatchObject({ orgs: 2, sites: 4 });
  });
  test("second server gets what the first doesn't use", () => {
    expect(allot(growth, [{ orgs: 1, sites: 3 }])).toMatchObject({ orgs: 1, sites: 1 });
  });
  test("never negative, never more than the pool", () => {
    expect(allot(growth, [{ orgs: 3, sites: 9 }])).toMatchObject({ orgs: 0, sites: 0 });
  });
  test("servers that never reported count as empty; other limits untouched", () => {
    expect(allot(growth, [null])).toEqual(growth);
  });
  test("unlimited stays unlimited", () => {
    expect(allot({ ...growth, sites: null }, [{ orgs: 1, sites: 50 }]).sites).toBeNull();
  });
});
