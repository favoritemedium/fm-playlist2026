import { describe, expect, it } from "vitest";
import { isContributorAdminEmail } from "./admin-constants";

describe("contributor admin authorization", () => {
  it("allows only the configured administrator email, case-insensitively", () => {
    expect(isContributorAdminEmail("CHANAKA@favoritemedium.com")).toBe(true);
    expect(isContributorAdminEmail("someone@favoritemedium.com")).toBe(false);
    expect(isContributorAdminEmail(null)).toBe(false);
  });
});
