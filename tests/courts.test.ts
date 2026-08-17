import { describe, it, expect } from "vitest";
import {
  COURTS,
  REGIONS,
  searchCourts,
  suggestCourt,
  isExactCourt,
  regionsForLocation,
  gameRegions,
  primaryRegion,
  parseVenue,
  formatVenue,
  courtCountFor,
} from "../src/lib/courts";

const first = (q: string) => searchCourts(q)[0]?.name;

describe("court data", () => {
  it("gives every court between one and two regions we actually filter by", () => {
    for (const c of COURTS) {
      expect(c.regions.length, `${c.name} has ${c.regions.length} regions`).toBeGreaterThan(0);
      expect(c.regions.length, `${c.name} has too many regions`).toBeLessThanOrEqual(2);
      expect(new Set(c.regions).size, `${c.name} repeats a region`).toBe(c.regions.length);
      for (const r of c.regions) {
        expect(REGIONS, `${c.name} has unknown region ${r}`).toContain(r);
      }
    }
  });

  it("only records a court count when it is a sane number", () => {
    for (const c of COURTS) {
      if (c.courts === undefined) continue;
      expect(c.courts, `${c.name} court count`).toBeGreaterThan(0);
      expect(c.courts, `${c.name} court count`).toBeLessThanOrEqual(20);
    }
  });

  it("has no duplicate names", () => {
    const names = COURTS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers all five regions", () => {
    for (const r of REGIONS) {
      expect(COURTS.some((c) => c.regions.includes(r)), `no courts in ${r}`).toBe(true);
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
    expect(first("ocbc")).toBe("OCBC Arena (The Kallang)");
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
    expect(suggestCourt("OCBC Arena (The Kallang)")).toBeNull();
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

describe("regionsForLocation", () => {
  it("reads the regions straight off a known court", () => {
    expect(regionsForLocation("Bedok Sport Hall")).toEqual(["East"]);
    expect(regionsForLocation("Woodlands Sport Hall")).toEqual(["North"]);
    expect(regionsForLocation("Palawan Beach")).toEqual(["South"]);
    expect(regionsForLocation("NTU Sports Hall")).toEqual(["West"]);
  });

  it("returns both regions for a boundary venue", () => {
    // The north-east: findable from either North or East, which is the whole
    // point of allowing two.
    expect(regionsForLocation("Hougang Sport Hall")).toEqual(["North", "East"]);
    expect(regionsForLocation("Sengkang Sport Hall")).toEqual(["North", "East"]);
    expect(regionsForLocation("OCBC Arena (The Kallang)")).toEqual(["Central", "East"]);
    expect(regionsForLocation("NUS Sports Hall (MPSH)")).toEqual(["West", "South"]);
  });

  it("recovers regions from a venue with extra detail on the end", () => {
    expect(regionsForLocation("Bedok Sport Hall, Court 2")).toEqual(["East"]);
    expect(regionsForLocation("Clementi Sport Hall (court 1 and 2)")).toEqual(["West"]);
  });

  it("falls back to the neighbourhood", () => {
    expect(regionsForLocation("Some new gym", "Tampines")).toEqual(["East"]);
    expect(regionsForLocation("Church hall in Yishun")).toEqual(["North"]);
  });

  it("returns empty rather than guessing when nothing matches", () => {
    expect(regionsForLocation("A friend's backyard")).toEqual([]);
    expect(regionsForLocation("")).toEqual([]);
  });
});

describe("gameRegions", () => {
  it("trusts the court over a saved region, since geography is a fact", () => {
    expect(gameRegions({ region: "South", location: "Bedok Sport Hall" })).toEqual(["East"]);
  });

  it("derives regions for games saved before the picker existed", () => {
    expect(gameRegions({ region: "", location: "Bedok Sport Hall" })).toEqual(["East"]);
    expect(gameRegions({ location: "Tampines somewhere", area: "Tampines" })).toEqual(["East"]);
  });

  it("uses the host's pick for a venue we don't know", () => {
    expect(gameRegions({ region: "West", location: "My condo function room" })).toEqual(["West"]);
  });

  it("ignores a saved region that isn't one of the five", () => {
    expect(gameRegions({ region: "Northeast", location: "Nowhere at all" })).toEqual([]);
  });

  it("makes a north-east game reachable from both filters", () => {
    const g = { region: "North", location: "Hougang Sport Hall" };
    expect(gameRegions(g)).toContain("North");
    expect(gameRegions(g)).toContain("East");
  });

  it("names one region for the card badge", () => {
    expect(primaryRegion({ region: "", location: "Hougang Sport Hall" })).toBe("North");
    expect(primaryRegion({ region: "", location: "Nowhere at all" })).toBe("");
  });
});

describe("court numbers", () => {
  it("writes the number into the venue the way hosts already do", () => {
    expect(formatVenue("Bedok Sport Hall", "2")).toBe("Bedok Sport Hall, Court 2");
    expect(formatVenue("Bedok Sport Hall", "")).toBe("Bedok Sport Hall");
  });

  it("round-trips a venue with a court number", () => {
    const v = formatVenue("Clementi Sport Hall", "2");
    const p = parseVenue(v);
    expect(p.base).toBe("Clementi Sport Hall");
    expect(p.courtLabel).toBe("2");
    expect(p.court?.name).toBe("Clementi Sport Hall");
  });

  it("parses a plain venue with no number", () => {
    const p = parseVenue("Bedok Sport Hall");
    expect(p.courtLabel).toBe("");
    expect(p.court?.name).toBe("Bedok Sport Hall");
  });

  it("leaves a custom venue whole even if it ends in a court number", () => {
    // Nothing before ", Court 3" resolves to a listed court, so splitting it
    // would strand the host with a base we can't place.
    const p = parseVenue("My condo function room, Court 3");
    expect(p.base).toBe("My condo function room, Court 3");
    expect(p.courtLabel).toBe("");
    expect(p.court).toBeNull();
  });

  it("does not mistake a venue whose name contains 'Courts' for a number", () => {
    const p = parseVenue("ActiveSG Courts @ Farrer Park");
    expect(p.courtLabel).toBe("");
    expect(p.court?.name).toBe("ActiveSG Courts @ Farrer Park");
  });

  it("still filters by region when a court number is attached", () => {
    expect(gameRegions({ region: "", location: "Sengkang Sport Hall, Court 4" }))
      .toEqual(["North", "East"]);
  });

  it("caps the picker at the verified count, and offers a range otherwise", () => {
    const bedok = COURTS.find((c) => c.name === "Bedok Sport Hall")!;
    expect(courtCountFor(bedok)).toBe(4);
    const unknown = COURTS.find((c) => c.courts === undefined)!;
    expect(courtCountFor(unknown)).toBe(8);
  });
});
