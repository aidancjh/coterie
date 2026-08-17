import { describe, it, expect } from "vitest";
import {
  COURTS,
  REGIONS,
  searchCourts,
  suggestCourt,
  isExactCourt,
  regionForLocation,
  gameRegion,
} from "../src/lib/courts";

const first = (q: string) => searchCourts(q)[0]?.name;

describe("court data", () => {
  it("gives every court a region we actually filter by", () => {
    for (const c of COURTS) {
      expect(REGIONS, `${c.name} has region ${c.region}`).toContain(c.region);
    }
  });

  it("has no duplicate names", () => {
    const names = COURTS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers all five regions", () => {
    for (const r of REGIONS) {
      expect(COURTS.some((c) => c.region === r), `no courts in ${r}`).toBe(true);
    }
  });

  it("keeps aliases unambiguous — one alias must not name two courts", () => {
    const seen = new Map<string, string>();
    for (const c of COURTS) {
      for (const a of c.aliases ?? []) {
        const prev = seen.get(a);
        expect(prev, `alias "${a}" is on both ${prev} and ${c.name}`).toBeUndefined();
        seen.set(a, c.name);
      }
    }
  });
});

describe("searchCourts", () => {
  it("finds a court from its opening letters", () => {
    expect(first("bedok")).toBe("Bedok Sport Hall");
    expect(first("clem")).toBe("Clementi Sport Hall");
  });

  it("matches the acronym players actually say", () => {
    expect(first("oth")).toBe("Our Tampines Hub Sport Hall");
    expect(first("ocbc")).toBe("OCBC Arena");
    expect(first("ntu")).toBe("NTU Sports Hall");
  });

  it("matches a word from the middle of the name", () => {
    expect(first("canberra")).toBe("Bukit Canberra Sport Hall");
    expect(first("evans")).toBe("MOE (Evans) Sport Hall");
  });

  it("ignores case and punctuation", () => {
    expect(first("HEARTBEAT@BEDOK")).toBe("Bedok Sport Hall");
    expect(first("moe (evans)")).toBe("MOE (Evans) Sport Hall");
  });

  it("tolerates the 'sports hall' vs 'sport hall' spelling either way", () => {
    expect(first("clementi sports hall")).toBe("Clementi Sport Hall");
    expect(first("clementi sport hall")).toBe("Clementi Sport Hall");
  });

  it("finds courts by neighbourhood", () => {
    expect(searchCourts("sentosa").map((c) => c.name)).toContain("Palawan Beach");
    expect(searchCourts("kallang").length).toBeGreaterThan(1);
  });

  it("accepts the words in any order", () => {
    expect(first("hall bedok")).toBe("Bedok Sport Hall");
  });

  it("returns a browsable list for an empty query", () => {
    expect(searchCourts("").length).toBeGreaterThan(0);
  });

  it("returns nothing for a query that resembles no court", () => {
    expect(searchCourts("zzzqqqxxxyy")).toHaveLength(0);
  });
});

describe("typo tolerance", () => {
  it("still finds the court despite a misspelling", () => {
    expect(first("clemeti")).toBe("Clementi Sport Hall");
    expect(first("jurong wset")).toBeTruthy();
    expect(first("yishn")).toBe("Yishun Sport Hall");
  });

  it("suggests the intended court for a typo", () => {
    expect(suggestCourt("clemeti")?.name).toBe("Clementi Sport Hall");
    expect(suggestCourt("sengkag")?.name).toBe("Sengkang Sport Hall");
  });

  it("does not nag when the name is already correct", () => {
    expect(suggestCourt("Clementi Sport Hall")).toBeNull();
    expect(suggestCourt("OCBC Arena")).toBeNull();
  });

  it("stays quiet on a genuinely unknown venue rather than guessing wildly", () => {
    expect(suggestCourt("my condo function room")).toBeNull();
  });

  it("does not forgive typos in very short queries", () => {
    // "bed" must not match "Bishan" — three letters is not enough signal.
    const names = searchCourts("bed").map((c) => c.name);
    expect(names.every((n) => n.toLowerCase().includes("bed"))).toBe(true);
  });
});

describe("isExactCourt", () => {
  it("recognises the canonical name and its aliases", () => {
    expect(isExactCourt("Bedok Sport Hall")?.name).toBe("Bedok Sport Hall");
    expect(isExactCourt("heartbeat bedok")?.name).toBe("Bedok Sport Hall");
    expect(isExactCourt("Bedok")).toBeNull();
  });
});

describe("regionForLocation", () => {
  it("reads the region straight off a known court", () => {
    expect(regionForLocation("Bedok Sport Hall")).toBe("East");
    expect(regionForLocation("Woodlands Sport Hall")).toBe("North");
    expect(regionForLocation("Palawan Beach")).toBe("South");
    expect(regionForLocation("OCBC Arena")).toBe("Central");
    expect(regionForLocation("NTU Sports Hall")).toBe("West");
  });

  it("recovers a region from a venue with extra detail on the end", () => {
    expect(regionForLocation("Bedok Sport Hall, Court 2")).toBe("East");
    expect(regionForLocation("Clementi Sport Hall (court 1 and 2)")).toBe("West");
  });

  it("falls back to the neighbourhood", () => {
    expect(regionForLocation("Some new gym", "Tampines")).toBe("East");
    expect(regionForLocation("Church hall in Yishun")).toBe("North");
  });

  it("returns empty rather than guessing when nothing matches", () => {
    expect(regionForLocation("A friend's backyard")).toBe("");
    expect(regionForLocation("")).toBe("");
  });
});

describe("gameRegion", () => {
  it("prefers what the host saved", () => {
    expect(gameRegion({ region: "South", location: "Bedok Sport Hall" })).toBe("South");
  });

  it("derives a region for games saved before the picker existed", () => {
    expect(gameRegion({ region: "", location: "Bedok Sport Hall" })).toBe("East");
    expect(gameRegion({ location: "Tampines somewhere", area: "Tampines" })).toBe("East");
  });

  it("ignores a saved region that isn't one of the five", () => {
    expect(gameRegion({ region: "Northeast", location: "Bedok Sport Hall" })).toBe("East");
  });
});
