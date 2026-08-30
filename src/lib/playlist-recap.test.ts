import { describe, expect, it } from "vitest";
import { getTopSubmitters } from "./playlist-recap";

describe("getTopSubmitters", () => {
  it("ranks submitters by submission count and limits the result", () => {
    const songs = ["Ada", "Grace", "Ada", "Linus", "Ada", "Grace", "Margaret"].map(
      (submitterName) => ({ submitterName })
    );

    expect(getTopSubmitters(songs, 3)).toEqual([
      { name: "Ada", count: 3 },
      { name: "Grace", count: 2 },
      { name: "Linus", count: 1 },
    ]);
  });

  it("combines case variants and ignores blank names", () => {
    const songs = ["Ada", " ada ", "ADA", "   "].map((submitterName) => ({
      submitterName,
    }));

    expect(getTopSubmitters(songs)).toEqual([{ name: "Ada", count: 3 }]);
  });
});
