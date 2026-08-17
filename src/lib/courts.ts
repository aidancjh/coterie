/**
 * Every volleyball venue in Singapore we know players actually use, tied to one
 * of five regions so Browse can filter by "near me" without asking anyone to
 * type a postcode.
 *
 * Why a fixed list at all: interviewees asked for it directly — "prefer if
 * courts / areas were options instead of open ended" (Feedback & Opinions.md).
 * Free text also makes region filtering impossible, since "Bedok Sports Hall",
 * "bedok sport hall" and "Heartbeat@Bedok" are the same building.
 *
 * Sources: the ActiveSG facilities listing (activesgcircle.gov.sg/facilities/
 * volleyball and the sport-hall pages), Sport Singapore, the Kallang/Sports Hub
 * booking pages, and the venues named in our own user interviews (NTU, MOE
 * Evans). School and campus halls are here because they are rented out to the
 * public — availability varies, which is the host's problem to state in notes,
 * not ours to model.
 *
 * Hosts can still type a venue that isn't here; the form keeps whatever they
 * type and asks them to pick the region by hand. Adding a court is a one-line
 * change to COURTS below.
 *
 * REGION CONVENTION — five buckets, no north-east. Singapore's north-east
 * (Sengkang, Punggol, Hougang, Serangoon, Ang Mo Kio) is folded into North,
 * which is how players group it in practice: one interviewee described their
 * usual courts as "mostly woodlands amk area".
 */

export type Region = "North" | "Central" | "East" | "West" | "South";

/** Display order — geographic, not alphabetical, so the chips read like a map. */
export const REGIONS: Region[] = ["North", "Central", "East", "West", "South"];

/** Surface, for the label in the picker. Not the same as the game's own type. */
export type CourtKind = "Indoor" | "Beach" | "Outdoor";

export interface Court {
  /** Canonical name. This is what gets saved as the game's location. */
  name: string;
  region: Region;
  /** Neighbourhood, saved as the game's `area` and shown on the card. */
  area: string;
  kind: CourtKind;
  /**
   * Extra spellings to match on: acronyms players actually say, old names, and
   * the "sports hall" spelling of every "sport hall" (ActiveSG drops the s,
   * nobody else does).
   */
  aliases?: string[];
}

export const COURTS: Court[] = [
  // --- ActiveSG sport halls -------------------------------------------------
  { name: "Bedok Sport Hall", region: "East", area: "Bedok", kind: "Indoor",
    aliases: ["bedok sports hall", "heartbeat@bedok", "heartbeat bedok"] },
  { name: "Bishan Sport Hall", region: "Central", area: "Bishan", kind: "Indoor",
    aliases: ["bishan sports hall"] },
  { name: "Bukit Canberra Sport Hall", region: "North", area: "Sembawang", kind: "Indoor",
    aliases: ["bukit canberra sports hall", "canberra"] },
  { name: "Bukit Gombak Sport Hall", region: "West", area: "Bukit Batok", kind: "Indoor",
    aliases: ["bukit gombak sports hall", "gombak"] },
  { name: "Choa Chu Kang Sport Hall", region: "West", area: "Choa Chu Kang", kind: "Indoor",
    aliases: ["choa chu kang sports hall", "cck"] },
  { name: "Clementi Sport Hall", region: "West", area: "Clementi", kind: "Indoor",
    aliases: ["clementi sports hall"] },
  { name: "Delta Sport Hall", region: "South", area: "Tiong Bahru", kind: "Indoor",
    aliases: ["delta sports hall", "delta sport centre"] },
  { name: "Hougang Sport Hall", region: "North", area: "Hougang", kind: "Indoor",
    aliases: ["hougang sports hall"] },
  { name: "Jurong East Sport Hall", region: "West", area: "Jurong East", kind: "Indoor",
    aliases: ["jurong east sports hall"] },
  { name: "Jurong West Sport Hall", region: "West", area: "Jurong West", kind: "Indoor",
    aliases: ["jurong west sports hall"] },
  { name: "MOE (Evans) Sport Hall", region: "Central", area: "Evans Road", kind: "Indoor",
    aliases: ["moe evans", "evans", "evans road", "moe evans sports hall"] },
  { name: "Pasir Ris Sport Hall", region: "East", area: "Pasir Ris", kind: "Indoor",
    aliases: ["pasir ris sports hall"] },
  { name: "Sengkang Sport Hall", region: "North", area: "Sengkang", kind: "Indoor",
    aliases: ["sengkang sports hall"] },
  { name: "Serangoon Sport Hall", region: "North", area: "Serangoon", kind: "Indoor",
    aliases: ["serangoon sports hall"] },
  { name: "Our Tampines Hub Sport Hall", region: "East", area: "Tampines", kind: "Indoor",
    aliases: ["oth", "our tampines hub", "tampines sport hall", "tampines sports hall"] },
  { name: "Toa Payoh Sport Hall", region: "Central", area: "Toa Payoh", kind: "Indoor",
    aliases: ["toa payoh sports hall"] },
  { name: "Woodlands Sport Hall", region: "North", area: "Woodlands", kind: "Indoor",
    aliases: ["woodlands sports hall"] },
  { name: "Yio Chu Kang Sport Hall", region: "North", area: "Ang Mo Kio", kind: "Indoor",
    aliases: ["yck", "yio chu kang sports hall"] },
  { name: "Yishun Sport Hall", region: "North", area: "Yishun", kind: "Indoor",
    aliases: ["yishun sports hall"] },
  { name: "Zhenghua Sport Hall", region: "West", area: "Bukit Panjang", kind: "Indoor",
    aliases: ["zhenghua sports hall"] },
  { name: "ActiveSG Courts @ Farrer Park", region: "Central", area: "Farrer Park", kind: "Outdoor",
    aliases: ["farrer park", "activesg farrer park"] },

  // --- Premium / private indoor --------------------------------------------
  { name: "OCBC Arena", region: "Central", area: "Kallang", kind: "Indoor",
    aliases: ["ocbc", "ocbc arena hall 1", "ocbc arena hall 2", "ocbc arena hall 3"] },
  { name: "The Kallang Indoor Courts", region: "Central", area: "Kallang", kind: "Indoor",
    aliases: ["the kallang", "sports hub indoor", "singapore sports hub", "kallang indoor"] },
  { name: "Singapore Badminton Hall", region: "Central", area: "Geylang", kind: "Indoor",
    aliases: ["sbh", "guillemard", "badminton hall"] },

  // --- Sand ----------------------------------------------------------------
  { name: "Yio Chu Kang Beach Volleyball Courts", region: "North", area: "Ang Mo Kio", kind: "Beach",
    aliases: ["yck beach", "yck sand", "yio chu kang sand"] },
  { name: "Sports Hub Beach Volleyball Courts", region: "Central", area: "Kallang", kind: "Beach",
    aliases: ["kallang beach", "kallang sand", "kallang volleyball centre", "sports hub beach"] },
  { name: "Palawan Beach", region: "South", area: "Sentosa", kind: "Beach",
    aliases: ["palawan", "sentosa palawan"] },
  { name: "Siloso Beach", region: "South", area: "Sentosa", kind: "Beach",
    aliases: ["siloso", "sentosa siloso"] },
  { name: "Tanjong Beach", region: "South", area: "Sentosa", kind: "Beach",
    aliases: ["tanjong", "sentosa tanjong"] },
  { name: "East Coast Park Beach Volleyball Courts", region: "East", area: "East Coast", kind: "Beach",
    aliases: ["ecp", "east coast park", "east coast beach"] },

  // --- Outdoor hard courts -------------------------------------------------
  { name: "MOE (Evans) Outdoor Court", region: "Central", area: "Evans Road", kind: "Outdoor",
    aliases: ["evans outdoor", "moe evans outdoor"] },
  { name: "Senja-Cashew CC Outdoor Courts", region: "West", area: "Bukit Panjang", kind: "Outdoor",
    aliases: ["senja cashew", "senja", "cashew cc"] },

  // --- Campus halls (rented to the public; availability varies) ------------
  { name: "NTU Sports Hall", region: "West", area: "Nanyang", kind: "Indoor",
    aliases: ["ntu", "nanyang technological university", "ntu mpsh"] },
  { name: "NUS Sports Hall (MPSH)", region: "West", area: "Kent Ridge", kind: "Indoor",
    aliases: ["nus", "mpsh", "kent ridge", "national university of singapore"] },
  { name: "SMU Sports Hall", region: "Central", area: "Bras Basah", kind: "Indoor",
    aliases: ["smu", "singapore management university"] },
  { name: "SUTD Sports Hall", region: "East", area: "Upper Changi", kind: "Indoor",
    aliases: ["sutd", "singapore university of technology and design"] },
  { name: "Republic Polytechnic Sports Hall", region: "North", area: "Woodlands", kind: "Indoor",
    aliases: ["republic poly", "rp"] },
  { name: "Nanyang Polytechnic Sports Hall", region: "North", area: "Ang Mo Kio", kind: "Indoor",
    aliases: ["nanyang poly", "nyp"] },
  { name: "Ngee Ann Polytechnic Sports Hall", region: "West", area: "Clementi", kind: "Indoor",
    aliases: ["ngee ann poly", "np"] },
  { name: "Singapore Polytechnic Sports Hall", region: "West", area: "Dover", kind: "Indoor",
    aliases: ["singapore poly", "sp hall"] },
  { name: "Temasek Polytechnic Sports Hall", region: "East", area: "Tampines", kind: "Indoor",
    aliases: ["temasek poly"] },

  // --- School halls on the ActiveSG volleyball listing ---------------------
  { name: "Ang Mo Kio Secondary School Hall", region: "North", area: "Ang Mo Kio", kind: "Indoor",
    aliases: ["amk sec", "ang mo kio sec"] },
  { name: "Bartley Secondary School Hall", region: "Central", area: "Bartley", kind: "Indoor",
    aliases: ["bartley sec"] },
  { name: "Fairfield Methodist Secondary School Hall", region: "West", area: "Dover", kind: "Indoor",
    aliases: ["fairfield methodist", "fairfield sec"] },
  { name: "Hougang Primary School Hall", region: "North", area: "Hougang", kind: "Indoor",
    aliases: ["hougang pri"] },
  { name: "Jurong West Secondary School Hall", region: "West", area: "Jurong West", kind: "Indoor",
    aliases: ["jurong west sec"] },
  { name: "Kuo Chuan Presbyterian Secondary School Hall", region: "Central", area: "Bishan", kind: "Indoor",
    aliases: ["kuo chuan", "kcpss"] },
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Lowercase, drop punctuation, collapse whitespace. "Heartbeat@Bedok" → "heartbeat bedok". */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** First letters of the significant words: "Our Tampines Hub Sport Hall" → "othsh". */
function acronym(name: string): string {
  const skip = new Set(["the", "of", "and", "at", "hall", "court", "courts", "school"]);
  return norm(name)
    .split(" ")
    .filter((w) => w && !skip.has(w))
    .map((w) => w[0])
    .join("");
}

/**
 * Levenshtein distance, abandoned as soon as it's provably over `max`. The cap
 * is what makes this cheap enough to run over every court on every keystroke:
 * a row whose smallest value already exceeds max can only grow.
 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** How much misspelling to forgive. Short queries get less — "bed" isn't "bee". */
function tolerance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

interface Scored {
  court: Court;
  score: number;
  /** True when we only got here by forgiving a misspelling. Drives "Did you mean…". */
  fuzzy: boolean;
}

/**
 * Score one court against a normalised query. Higher is better, -1 means no
 * match at all. The tiers are ordered so that what the user most likely meant
 * sorts first: an exact name, then a name that starts with what they typed,
 * then a word inside the name, then a substring anywhere, then all their words
 * present in any order, and only then a misspelling.
 */
function scoreCourt(court: Court, q: string): Scored | null {
  const name = norm(court.name);
  const area = norm(court.area);
  const haystacks = [name, area, acronym(court.name), ...(court.aliases ?? []).map(norm)];

  let best = -1;
  let fuzzy = false;

  for (const h of haystacks) {
    if (!h) continue;
    const isName = h === name;
    // Aliases and the area are shortcuts, not the real name — rank them just
    // below the canonical name so "Tampines" surfaces Our Tampines Hub without
    // outranking a court literally called Tampines something.
    const bonus = isName ? 40 : 0;

    if (h === q) { best = Math.max(best, 1000 + bonus); continue; }
    if (h.startsWith(q)) { best = Math.max(best, 900 + bonus - (h.length - q.length)); continue; }
    const words = h.split(" ");
    if (words.some((w) => w.startsWith(q))) { best = Math.max(best, 800 + bonus); continue; }
    if (h.includes(q)) { best = Math.max(best, 700 + bonus); continue; }

    // Every word the user typed appears as the start of some word here, in any
    // order: "hall bedok" should still find "Bedok Sport Hall".
    const qWords = q.split(" ").filter(Boolean);
    if (qWords.length > 1 && qWords.every((qw) => words.some((w) => w.startsWith(qw)))) {
      best = Math.max(best, 650 + bonus);
      continue;
    }

    // Typos. Compare the query against the whole haystack and against each of
    // its words, so both "bedok sprot hall" and "bedok sprot" land.
    const tol = tolerance(q.length);
    if (tol > 0) {
      let d = editDistance(q, h, tol);
      for (const w of words) {
        if (d === 0) break;
        d = Math.min(d, editDistance(q, w, tol));
      }
      if (d <= tol) {
        const s = 500 + bonus - d * 60;
        if (s > best) { best = s; fuzzy = true; }
      }
    }
  }

  return best < 0 ? null : { court, score: best, fuzzy };
}

/**
 * Courts matching `query`, best first. An empty query returns everything, so
 * the picker can open as a plain browsable list.
 */
export function searchCourts(query: string, limit = 8): Court[] {
  const q = norm(query);
  if (!q) return COURTS.slice(0, limit);
  return COURTS.map((c) => scoreCourt(c, q))
    .filter((r): r is Scored => r !== null)
    .sort((a, b) => b.score - a.score || a.court.name.localeCompare(b.court.name))
    .slice(0, limit)
    .map((r) => r.court);
}

/** True when `query` already names this court exactly (ignoring case/punctuation). */
export function isExactCourt(query: string): Court | null {
  const q = norm(query);
  if (!q) return null;
  return (
    COURTS.find((c) => norm(c.name) === q) ??
    COURTS.find((c) => (c.aliases ?? []).some((a) => norm(a) === q)) ??
    null
  );
}

/**
 * Our single best guess at what a misspelling meant, or null if nothing is
 * close. Only returns a court the user has NOT already typed correctly, since
 * "did you mean X" under an exact match on X is just noise.
 */
export function suggestCourt(query: string): Court | null {
  const q = norm(query);
  if (q.length < 3 || isExactCourt(q)) return null;
  const scored = COURTS.map((c) => scoreCourt(c, q))
    .filter((r): r is Scored => r !== null)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  // Only worth suggesting if we had to forgive something. A clean prefix match
  // is already sitting in the dropdown where they can see it.
  return top && top.fuzzy ? top.court : null;
}

/** Court whose canonical name or alias is exactly this saved location. */
export function courtByName(name: string): Court | null {
  return isExactCourt(name);
}

/**
 * Best-effort region for a game saved before the picker existed, or by a host
 * who typed a custom venue. Matches the venue text against court names, then
 * against area names, then gives up — an unknown region is honest, and Browse
 * treats it as "not in any region" rather than guessing wrong.
 */
export function regionForLocation(location: string, area?: string): Region | "" {
  const direct = isExactCourt(location);
  if (direct) return direct.region;

  const hay = norm(`${location} ${area ?? ""}`);
  if (!hay) return "";

  // Longest court name first, so "Yio Chu Kang Beach Volleyball Courts" wins
  // over a bare "Yio Chu Kang Sport Hall" when both could match the text.
  const byLength = [...COURTS].sort((a, b) => b.name.length - a.name.length);
  for (const c of byLength) {
    if (hay.includes(norm(c.name))) return c.region;
    if ((c.aliases ?? []).some((a) => a.length >= 4 && hay.includes(norm(a)))) return c.region;
  }
  for (const c of byLength) {
    if (hay.includes(norm(c.area))) return c.region;
  }
  return "";
}

/** The region to filter a game by: what the host saved, else derived from text. */
export function gameRegion(game: { region?: string; location: string; area?: string }): Region | "" {
  const saved = (game.region ?? "") as Region | "";
  if (saved && (REGIONS as string[]).includes(saved)) return saved;
  return regionForLocation(game.location, game.area);
}
