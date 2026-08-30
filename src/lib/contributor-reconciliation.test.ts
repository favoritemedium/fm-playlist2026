import { describe, expect, it } from "vitest";
import {
  BLANK_LEGACY_NAME_KEY,
  normalizeLegacyName,
  suggestContributorCandidate,
  type ContributorCandidate,
} from "./contributor-reconciliation";

const candidates: ContributorCandidate[] = [
  { userId: "user_chanaka", name: "Chanaka Karunarathne", email: "chanaka@favoritemedium.com" },
  { userId: "user_asri", name: "Asri Jaffar", email: "asri@favoritemedium.com" },
];

describe("contributor reconciliation helpers", () => {
  it("normalizes case and repeated whitespace without discarding the original spelling", () => {
    expect(normalizeLegacyName("  Chanaka   Karunarathne ")).toBe("chanaka karunarathne");
  });

  it("gives blank Airtable names a stable reconciliation key", () => {
    expect(normalizeLegacyName("   ")).toBe(BLANK_LEGACY_NAME_KEY);
    expect(normalizeLegacyName("(Blank Airtable name)")).toBe(BLANK_LEGACY_NAME_KEY);
  });

  it("suggests an exact or token-equivalent account", () => {
    expect(suggestContributorCandidate("CHANAKA  KARUNARATHNE", candidates)?.userId).toBe(
      "user_chanaka"
    );
  });

  it("can suggest from the email local part", () => {
    expect(suggestContributorCandidate("Asri", candidates)?.userId).toBe("user_asri");
  });

  it("does not suggest unrelated accounts", () => {
    expect(suggestContributorCandidate("Completely Different Person", candidates)).toBeNull();
  });
});
