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
 * REGION CONVENTION — five buckets, and a court may sit in TWO of them.
 * Singapore has no clean five-way split: Hougang and Sengkang are "north-east",
 * Kallang is central but everyone on the east side treats it as theirs, Dover
 * and Kent Ridge are west but also south. Rather than pick a side and be wrong
 * for half our players, a boundary court belongs to both regions and turns up
 * under either filter. The first entry in `regions` is the primary one — it is
 * what gets saved on the game and shown first on the card.
 */

export type Region = "North" | "Central" | "East" | "West" | "South";

/** Display order — geographic, not alphabetical, so the chips read like a map. */
export const REGIONS: Region[] = ["North", "Central", "East", "West", "South"];

/** Surface, for the label in the picker. Not the same as the game's own type. */
export type CourtKind = "Indoor" | "Beach" | "Outdoor";

export interface Court {
  /** Canonical name. This is what gets saved as the game's location. */
  name: string;
  /**
   * One or two regions this venue can be found under, primary first. Two means
   * it sits on a boundary and should appear under either filter.
   */
  regions: Region[];
  /** Neighbourhood, saved as the game's `area` and shown on the card. */
  area: string;
  kind: CourtKind;
  /**
   * How many volleyball courts the venue has, where we could verify it — used
   * to cap the "which court?" picker. Left unset when sources disagree or say
   * nothing; the picker then offers a generous range instead of inventing a
   * number. Never guess this: a wrong cap stops a host naming their real court.
   */
  courts?: number;
  /**
   * Extra spellings to match on: acronyms players actually say, old names, and
   * the "sports hall" spelling of every "sport hall" (ActiveSG drops the s,
   * nobody else does).
   */
  aliases?: string[];
}

export const COURTS: Court[] = [
  // --- ActiveSG sport halls -------------------------------------------------
  { name: "Bedok Sport Hall", regions: ["East"], area: "Bedok", kind: "Indoor", courts: 4,
    aliases: ["bedok sports hall", "heartbeat@bedok", "heartbeat bedok"] },
  { name: "Bishan Sport Hall", regions: ["Central", "North"], area: "Bishan", kind: "Indoor",
    aliases: ["bishan sports hall"] },
  { name: "Bukit Canberra Sport Hall", regions: ["North"], area: "Sembawang", kind: "Indoor",
    aliases: ["bukit canberra sports hall", "canberra"] },
  { name: "Bukit Gombak Sport Hall", regions: ["West"], area: "Bukit Batok", kind: "Indoor",
    aliases: ["bukit gombak sports hall", "gombak"] },
  { name: "Choa Chu Kang Sport Hall", regions: ["West"], area: "Choa Chu Kang", kind: "Indoor",
    aliases: ["choa chu kang sports hall", "cck"] },
  { name: "Clementi Sport Hall", regions: ["West"], area: "Clementi", kind: "Indoor", courts: 2,
    aliases: ["clementi sports hall"] },
  { name: "Delta Sport Hall", regions: ["South", "Central"], area: "Tiong Bahru", kind: "Indoor",
    aliases: ["delta sports hall", "delta sport centre"] },
  { name: "Hougang Sport Hall", regions: ["North", "East"], area: "Hougang", kind: "Indoor",
    aliases: ["hougang sports hall"] },
  { name: "Jurong East Sport Hall", regions: ["West"], area: "Jurong East", kind: "Indoor",
    aliases: ["jurong east sports hall"] },
  { name: "Jurong West Sport Hall", regions: ["West"], area: "Jurong West", kind: "Indoor",
    aliases: ["jurong west sports hall"] },
  { name: "MOE (Evans) Sport Hall", regions: ["Central"], area: "Evans Road", kind: "Indoor", courts: 3,
    aliases: ["moe evans", "evans", "evans road", "moe evans sports hall"] },
  { name: "Pasir Ris Sport Hall", regions: ["East"], area: "Pasir Ris", kind: "Indoor",
    aliases: ["pasir ris sports hall"] },
  { name: "Sengkang Sport Hall", regions: ["North", "East"], area: "Sengkang", kind: "Indoor", courts: 6,
    aliases: ["sengkang sports hall"] },
  { name: "Serangoon Sport Hall", regions: ["North", "East"], area: "Serangoon", kind: "Indoor",
    aliases: ["serangoon sports hall"] },
  { name: "Our Tampines Hub Sport Hall", regions: ["East"], area: "Tampines", kind: "Indoor",
    aliases: ["oth", "our tampines hub", "tampines sport hall", "tampines sports hall"] },
  { name: "Toa Payoh Sport Hall", regions: ["Central"], area: "Toa Payoh", kind: "Indoor",
    aliases: ["toa payoh sports hall"] },
  { name: "Woodlands Sport Hall", regions: ["North"], area: "Woodlands", kind: "Indoor",
    aliases: ["woodlands sports hall"] },
  { name: "Yio Chu Kang Sport Hall", regions: ["North", "East"], area: "Ang Mo Kio", kind: "Indoor", courts: 2,
    aliases: ["yck", "yio chu kang sports hall"] },
  { name: "Yishun Sport Hall", regions: ["North"], area: "Yishun", kind: "Indoor",
    aliases: ["yishun sports hall"] },
  { name: "Zhenghua Sport Hall", regions: ["West", "North"], area: "Bukit Panjang", kind: "Indoor",
    aliases: ["zhenghua sports hall"] },
  { name: "ActiveSG Courts @ Farrer Park", regions: ["Central"], area: "Farrer Park", kind: "Outdoor",
    aliases: ["farrer park", "activesg farrer park"] },

  // --- Premium indoor ------------------------------------------------------
  // One building, many names: the Sports Hub was rebranded "The Kallang", and
  // its indoor volleyball sits in the OCBC Arena (Hall 3). Kept as a single
  // entry with every name as an alias, rather than three near-duplicates a host
  // would have to choose between. Court count omitted on purpose — sources say
  // both "2 indoor volleyball courts" and "seven indoor courts", so the picker
  // offers the open range instead of enforcing a number we can't stand behind.
  { name: "OCBC Arena (The Kallang)", regions: ["Central", "East"], area: "Kallang", kind: "Indoor",
    aliases: ["ocbc", "ocbc arena", "the kallang", "kallang indoor", "sports hub indoor",
              "singapore sports hub", "ocbc arena hall 3"] },
  { name: "Singapore Badminton Hall", regions: ["Central", "East"], area: "Geylang", kind: "Indoor",
    aliases: ["sbh", "guillemard", "badminton hall"] },

  // --- Sand ----------------------------------------------------------------
  { name: "Yio Chu Kang Beach Volleyball Courts", regions: ["North", "East"], area: "Ang Mo Kio", kind: "Beach", courts: 3,
    aliases: ["yck beach", "yck sand", "yio chu kang sand"] },
  { name: "Sports Hub Beach Volleyball Courts", regions: ["Central", "East"], area: "Kallang", kind: "Beach", courts: 2,
    aliases: ["kallang beach", "kallang sand", "kallang volleyball centre", "sports hub beach"] },
  { name: "Palawan Beach", regions: ["South"], area: "Sentosa", kind: "Beach",
    aliases: ["palawan", "sentosa palawan"] },
  { name: "Siloso Beach", regions: ["South"], area: "Sentosa", kind: "Beach",
    aliases: ["siloso", "sentosa siloso"] },
  { name: "Tanjong Beach", regions: ["South"], area: "Sentosa", kind: "Beach",
    aliases: ["tanjong", "sentosa tanjong"] },
  { name: "East Coast Park Beach Volleyball Courts", regions: ["East", "South"], area: "East Coast", kind: "Beach",
    aliases: ["ecp", "east coast park", "east coast beach"] },

  // --- Outdoor hard courts -------------------------------------------------
  { name: "MOE (Evans) Outdoor Court", regions: ["Central"], area: "Evans Road", kind: "Outdoor",
    aliases: ["evans outdoor", "moe evans outdoor"] },
  { name: "Senja-Cashew CC Outdoor Courts", regions: ["West", "North"], area: "Bukit Panjang", kind: "Outdoor", courts: 2,
    aliases: ["senja cashew", "senja", "cashew cc"] },

  // --- Campus halls (rented to the public; availability varies) ------------
  { name: "NTU Sports Hall", regions: ["West"], area: "Nanyang", kind: "Indoor",
    aliases: ["ntu", "nanyang technological university", "ntu mpsh"] },
  { name: "NUS Sports Hall (MPSH)", regions: ["West", "South"], area: "Kent Ridge", kind: "Indoor",
    aliases: ["nus", "mpsh", "kent ridge", "national university of singapore"] },
  { name: "SMU Sports Hall", regions: ["Central"], area: "Bras Basah", kind: "Indoor",
    aliases: ["smu", "singapore management university"] },
  { name: "SUTD Sports Hall", regions: ["East"], area: "Upper Changi", kind: "Indoor",
    aliases: ["sutd", "singapore university of technology and design"] },
  { name: "Republic Polytechnic Sports Hall", regions: ["North"], area: "Woodlands", kind: "Indoor",
    aliases: ["republic poly", "rp"] },
  { name: "Nanyang Polytechnic Sports Hall", regions: ["North", "East"], area: "Ang Mo Kio", kind: "Indoor",
    aliases: ["nanyang poly", "nyp"] },
  { name: "Ngee Ann Polytechnic Sports Hall", regions: ["West"], area: "Clementi", kind: "Indoor",
    aliases: ["ngee ann poly", "np"] },
  { name: "Singapore Polytechnic Sports Hall", regions: ["West", "South"], area: "Dover", kind: "Indoor",
    aliases: ["singapore poly", "sp hall"] },
  { name: "Temasek Polytechnic Sports Hall", regions: ["East"], area: "Tampines", kind: "Indoor",
    aliases: ["temasek poly"] },

  // --- School halls on the ActiveSG volleyball listing ---------------------
  { name: "Ang Mo Kio Secondary School Hall", regions: ["North", "East"], area: "Ang Mo Kio", kind: "Indoor",
    aliases: ["amk sec", "ang mo kio sec"] },
  { name: "Bartley Secondary School Hall", regions: ["Central", "East"], area: "Bartley", kind: "Indoor",
    aliases: ["bartley sec"] },
  { name: "Fairfield Methodist Secondary School Hall", regions: ["West", "South"], area: "Dover", kind: "Indoor",
    aliases: ["fairfield methodist", "fairfield sec"] },
  { name: "Hougang Primary School Hall", regions: ["North", "East"], area: "Hougang", kind: "Indoor",
    aliases: ["hougang pri"] },
  { name: "Jurong West Secondary School Hall", regions: ["West"], area: "Jurong West", kind: "Indoor",
    aliases: ["jurong west sec"] },
  { name: "Kuo Chuan Presbyterian Secondary School Hall", regions: ["Central", "North"], area: "Bishan", kind: "Indoor",
    aliases: ["kuo chuan", "kcpss"] },
  { name: "Woodlands Primary School Hall", regions: ["North"], area: "Woodlands", kind: "Indoor",
    aliases: ["woodlands pri"] },
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
 * The court a venue string refers to, ignoring any ", Court N" the host added.
 * Longest name first, so "Yio Chu Kang Beach Volleyball Courts" wins over a
 * bare "Yio Chu Kang Sport Hall" when both could match the text.
 */
function courtFromText(location: string, area?: string): Court | null {
  const direct = parseVenue(location).court;
  if (direct) return direct;

  const hay = norm(`${location} ${area ?? ""}`);
  if (!hay) return null;

  const byLength = [...COURTS].sort((a, b) => b.name.length - a.name.length);
  for (const c of byLength) {
    if (hay.includes(norm(c.name))) return c;
    if ((c.aliases ?? []).some((a) => a.length >= 4 && hay.includes(norm(a)))) return c;
  }
  for (const c of byLength) {
    if (hay.includes(norm(c.area))) return c;
  }
  return null;
}

/**
 * Best-effort regions for a game saved before the picker existed, or by a host
 * who typed a custom venue. Returns [] rather than guessing when nothing
 * matches — an unknown region is honest, and Browse treats it as "not in any
 * region" instead of putting the game somewhere wrong.
 */
export function regionsForLocation(location: string, area?: string): Region[] {
  return courtFromText(location, area)?.regions ?? [];
}

/**
 * Every region a game should be findable under. A listed court's own regions
 * win, because where a building is, is a fact — and they may be two. A custom
 * venue falls back to whatever region the host picked.
 */
export function gameRegions(game: { region?: string; location: string; area?: string }): Region[] {
  const fromCourt = regionsForLocation(game.location, game.area);
  if (fromCourt.length) return fromCourt;
  const saved = (game.region ?? "") as Region;
  return (REGIONS as string[]).includes(saved) ? [saved] : [];
}

/** The one region to show on a card: the court's primary, else what was saved. */
export function primaryRegion(game: { region?: string; location: string; area?: string }): Region | "" {
  return gameRegions(game)[0] ?? "";
}

// ---------------------------------------------------------------------------
// Court numbers
//
// A venue often has several courts and hosts have always written the number
// into the venue line by hand — the old placeholder was literally
// "e.g. Bedok Sports Hall, Court 2". So the number lives in the same string,
// as a ", Court N" suffix, rather than needing a new database column.
// ---------------------------------------------------------------------------

/** "Bedok Sport Hall" + "2" -> "Bedok Sport Hall, Court 2". */
export function formatVenue(courtName: string, courtLabel: string): string {
  const label = courtLabel.trim();
  return label ? `${courtName}, Court ${label}` : courtName;
}

/**
 * Split a saved venue back into the court and its number, so editing a game
 * reopens the picker in the state the host left it.
 *
 * The suffix only counts when what precedes it is a court we actually know.
 * That keeps a custom venue that happens to end in ", Court 3" intact instead
 * of silently splitting it into a base we can't resolve.
 */
export function parseVenue(location: string): {
  /** Venue without the court suffix. */
  base: string;
  /** Court number/name as the host wrote it, or "". */
  courtLabel: string;
  /** The matching listed court, or null for a custom venue. */
  court: Court | null;
} {
  const m = location.match(/^(.*?),\s*Court\s+(.+)$/i);
  if (m) {
    const base = m[1].trim();
    const court = isExactCourt(base);
    if (court) return { base, courtLabel: m[2].trim(), court };
  }
  return { base: location, courtLabel: "", court: isExactCourt(location) };
}

/**
 * How many courts to offer in the picker. Uses the verified count where we have
 * one; otherwise 8, which covers every venue we know of and still lets a host
 * name a court at a venue whose size we never confirmed.
 */
export function courtCountFor(court: Court): number {
  return court.courts ?? 8;
}
