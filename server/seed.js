// Seeds demo data the first time the DB is empty.
// syncDemoPasswords() runs on EVERY startup so login credentials stay
// predictable even after the DB already existed.
// syncDemoData() runs on EVERY startup and updates existing demo rows in
// place (names, venues, notes) so data changes here reach a DB that was
// seeded with older values.
// seedPastData() is idempotent — safe to call any time via the admin endpoint.
import { query, uid } from "./db.js";
import { hashPassword } from "./auth.js";

// ─── Easy-to-remember credentials ──────────────────────────────────────────
// Email pattern:  [number]@demo.test   e.g. 1@demo.test
// Password:       111111  (for ALL demo accounts)
// ────────────────────────────────────────────────────────────────────────────
const DEMO_PASSWORD = "111111";

const demoUsers = [
  {
    id: "user_maria", name: "Jia Min T.", email: "1@demo.test",
    skill: "Intermediate", homeArea: "Tampines",
    bio: "Hooked on volleyball since JC. Play 2–3 times a week — here for good rallies and good vibes.",
  },
  {
    id: "user_theo", name: "Wei Jie L.", email: "2@demo.test",
    skill: "Advanced", homeArea: "Serangoon",
    bio: "Setter by trade. Played for my poly team, 8 years in the scene. Always down for a good rally.",
  },
  {
    id: "user_grace", name: "Nur Aisyah B.", email: "3@demo.test",
    skill: "Beginner", homeArea: "Woodlands",
    bio: "Picked up volleyball 3 months ago and I'm hooked. Please be patient with my serves!",
  },
  {
    id: "user_dre", name: "Arjun N.", email: "4@demo.test",
    skill: "Advanced", homeArea: "Jurong East",
    bio: "Former school team libero. I love digging impossible balls. Host competitive games every week.",
  },
  {
    id: "user_nina", name: "Hui Wen O.", email: "5@demo.test",
    skill: "All Levels", homeArea: "Pasir Ris",
    bio: "Weekend warrior. Beach volley at Sentosa, East Coast picnics, good vibes — that's my thing.",
  },
  ...[
    { name: "Jun Wei",  skill: "Intermediate", area: "Ang Mo Kio" },
    { name: "Priya",    skill: "Advanced",     area: "Sembawang" },
    { name: "Zhi Hao",  skill: "Beginner",     area: "Bukit Batok" },
    { name: "Kai Xin",  skill: "Intermediate", area: "Bedok" },
    { name: "Syafiq",   skill: "Advanced",     area: "Tampines" },
    { name: "Mei Ling", skill: "Beginner",     area: "Clementi" },
    { name: "Xin Yi",   skill: "Intermediate", area: "Punggol" },
    { name: "Haziq",    skill: "Advanced",     area: "Yishun" },
    { name: "Shu Hui",  skill: "Intermediate", area: "Toa Payoh" },
    { name: "Ethan",    skill: "Beginner",     area: "Sengkang" },
    { name: "Wen Qian", skill: "Advanced",     area: "Hougang" },
    { name: "Aiman",    skill: "Beginner",     area: "Choa Chu Kang" },
    { name: "Li Ting",  skill: "Intermediate", area: "Queenstown" },
    { name: "Karthik",  skill: "Advanced",     area: "Boon Lay" },
    { name: "Hui Min",  skill: "Intermediate", area: "Marine Parade" },
    { name: "Marcus",   skill: "Advanced",     area: "Bishan" },
    { name: "Yu Xuan",  skill: "Intermediate", area: "Kallang" },
    { name: "Jian Hao", skill: "Advanced",     area: "Bukit Panjang" },
    { name: "Nurul",    skill: "All Levels",   area: "Geylang" },
    { name: "Siti",     skill: "Intermediate", area: "Bukit Merah" },
    { name: "Darren",   skill: "Advanced",     area: "Novena" },
    { name: "Xiu Wen",  skill: "Beginner",     area: "Jurong West" },
    { name: "Keith",    skill: "Intermediate", area: "Telok Blangah" },
    { name: "Devi",     skill: "All Levels",   area: "Simei" },
  ].map((u, i) => ({
    id: `user_p${i}`,
    name: u.name,
    email: `${u.name.toLowerCase().replace(/[^a-z]/g, "")}@demo.test`,
    skill: u.skill,
    homeArea: u.area,
    bio: "",
  })),
];

const demoGames = [
  {
    id: "game_demo_1",
    title: "Friday Night 6s @ Bedok",
    type: "Indoor", skill: "Intermediate",
    date: "2026-06-19", time: "18:30",
    location: "Bedok Sports Hall (ActiveSG), Court 2", area: "Bedok",
    total_slots: 12, host_id: "user_maria",
    notes: "Casual but competitive 6v6. Rotate teams every game. Bring a light and dark shirt.",
    roster: ["user_maria", "user_p0", "user_p1", "user_p2", "user_p3", "user_p4", "user_p5"],
  },
  {
    id: "game_demo_2",
    title: "Saturday Beach Volley @ Siloso",
    type: "Beach", skill: "All Levels",
    date: "2026-06-22", time: "10:00",
    location: "Siloso Beach, Sentosa — Nets 4–5", area: "Sentosa",
    total_slots: 8, host_id: "user_theo",
    notes: "Mixed doubles, king-of-the-court format. Sunscreen mandatory.",
    roster: ["user_theo", "user_p6", "user_p7", "user_p8", "user_p9", "user_p10"],
  },
  {
    id: "game_demo_3",
    title: "Sunday Beginner Session",
    type: "Indoor", skill: "Beginner",
    date: "2026-06-21", time: "16:00",
    location: "Clementi Sports Hall (ActiveSG)", area: "Clementi",
    total_slots: 12, host_id: "user_grace",
    notes: "New to volleyball? Perfect. We focus on passing, setting, and serving — then play games.",
    roster: ["user_grace", "user_p11", "user_p12"],
  },
  {
    id: "game_demo_4",
    title: "Competitive 6s @ OCBC Arena",
    type: "Indoor", skill: "Advanced",
    date: "2026-06-20", time: "19:00",
    location: "OCBC Arena, Hall 1", area: "Kallang",
    total_slots: 12, host_id: "user_dre",
    notes: "High-level play only. Please join if you can pass, set, and hit consistently.",
    roster: ["user_dre", "user_p13", "user_p14", "user_p15", "user_p16", "user_p17", "user_p18", "user_p19", "user_p20", "user_p21", "user_p22"],
  },
  {
    id: "game_demo_5",
    title: "Chill Grass 4s @ West Coast Park",
    type: "Grass", skill: "All Levels",
    date: "2026-06-27", time: "11:00",
    location: "West Coast Park, Grand Lawn", area: "West Coast",
    total_slots: 8, host_id: "user_nina",
    notes: "Relaxed grass volleyball + picnic after. Family friendly. Bring snacks to share!",
    roster: ["user_nina", "user_p23"],
  },
  {
    id: "game_demo_6",
    title: "Early Bird Beach Session",
    type: "Beach", skill: "Intermediate",
    date: "2026-06-25", time: "07:30",
    location: "Siloso Beach, Sentosa", area: "Sentosa",
    total_slots: 6, host_id: "user_p1",
    notes: "Early birds only! Light warmup jog then 2-hour rally session. Kopi after.",
    roster: ["user_p1", "user_p3", "user_p7"],
  },
  {
    id: "game_demo_7",
    title: "Wednesday Night Volley @ Hougang",
    type: "Indoor", skill: "Intermediate",
    date: "2026-06-24", time: "20:00",
    location: "Hougang Sports Hall (ActiveSG)", area: "Hougang",
    total_slots: 10, host_id: "user_p4",
    notes: "Chill midweek game after work. 5v5 format. 5 min walk from Hougang MRT.",
    roster: ["user_p4", "user_p5", "user_p6", "user_p8", "user_p9", "user_p10"],
  },
  {
    id: "game_demo_8",
    title: "Advanced Grass Doubles",
    type: "Grass", skill: "Advanced",
    date: "2026-06-28", time: "09:00",
    location: "East Coast Park, Area C lawn", area: "East Coast",
    total_slots: 4, host_id: "user_p13",
    notes: "Serious doubles practice. Looking for players who can serve, pass, and attack consistently.",
    roster: ["user_p13", "user_p15"],
  },
  {
    id: "game_demo_9",
    title: "Sunset Beach 6s @ Tanjong",
    type: "Beach", skill: "Intermediate",
    date: "2026-06-26", time: "17:00",
    location: "Tanjong Beach, Sentosa", area: "Sentosa",
    total_slots: 12, host_id: "user_p17",
    notes: "Best sunset spot on the island. 3 sets then dinner after.",
    roster: ["user_p17", "user_p18", "user_p19", "user_p20", "user_p0", "user_p2"],
  },
  {
    id: "game_demo_10",
    title: "Beginner-Friendly Beach Day",
    type: "Beach", skill: "Beginner",
    date: "2026-07-04", time: "13:00",
    location: "Siloso Beach, Sentosa", area: "Sentosa",
    total_slots: 8, host_id: "user_p11",
    notes: "Low pressure, high fun. Great intro to beach volleyball. Sunscreen provided!",
    roster: ["user_p11", "user_p12", "user_p22", "user_p23"],
  },
];

function resolveUserId(entry) {
  const byId = demoUsers.find((u) => u.id === entry);
  if (byId) return byId.id;
  const byName = demoUsers.find((u) => u.name === entry);
  return byName ? byName.id : null;
}

/** Runs every startup — keeps ALL @demo.test accounts at password 111111. */
export async function syncDemoPasswords() {
  const pw = hashPassword(DEMO_PASSWORD);
  const { rowCount } = await query(
    "UPDATE users SET password_hash = $1 WHERE email LIKE '%@demo.test'",
    [pw]
  );
  if (rowCount > 0) {
    console.log(
      `[seed] synced ${rowCount} demo accounts → password: "${DEMO_PASSWORD}"\n` +
      `[seed] main logins: 1@demo.test … 5@demo.test`
    );
  }
}

/** Runs every startup — updates existing demo rows in place so edits to the
 *  data above (names, areas, venues, notes) reach a DB seeded with older
 *  values. Only touches rows with the static demo IDs. */
export async function syncDemoData() {
  for (const u of demoUsers) {
    await query(
      `UPDATE users SET name = $1, email = $2, skill = $3, home_area = $4, bio = $5
       WHERE id = $6
         AND (name <> $1 OR email <> $2 OR skill <> $3
              OR home_area IS DISTINCT FROM $4 OR bio IS DISTINCT FROM $5)`,
      [u.name, u.email, u.skill, u.homeArea, u.bio || "", u.id]
    );
  }
  for (const g of demoGames) {
    await query(
      `UPDATE games SET title = $1, location = $2, area = $3, notes = $4
       WHERE id = $5
         AND (title <> $1 OR location <> $2
              OR area IS DISTINCT FROM $3 OR notes IS DISTINCT FROM $4)`,
      [g.title, g.location, g.area, g.notes, g.id]
    );
  }
}

/** Runs once on empty DB to insert all demo data. */
export async function seedIfEmpty() {
  const { rows } = await query("SELECT COUNT(*) AS c FROM users");
  if (Number(rows[0].c) > 0) return;

  const now = new Date().toISOString();
  const pw = hashPassword(DEMO_PASSWORD);

  for (const u of demoUsers) {
    await query(
      `INSERT INTO users (id, email, password_hash, name, skill, home_area, bio, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, pw, u.name, u.skill, u.homeArea, u.bio || "", now]
    );
  }

  for (const g of demoGames) {
    await query(
      `INSERT INTO games
         (id, title, type, skill, date, time, location, area, total_slots, pre_filled, host_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [g.id, g.title, g.type, g.skill, g.date, g.time,
       g.location, g.area, g.total_slots, g.host_id, g.notes, now]
    );
    let seq = 0;
    for (const entry of g.roster) {
      const userId = resolveUserId(entry);
      if (userId) {
        await query(
          `INSERT INTO game_members (game_id, user_id, status, seq)
           VALUES ($1, $2, 'player', $3) ON CONFLICT DO NOTHING`,
          [g.id, userId, seq]
        );
        seq += 1;
      }
    }
  }

  console.log(
    `[seed] inserted ${demoUsers.length} demo users and ${demoGames.length} games\n` +
    `[seed] demo logins: 1@demo.test … 5@demo.test  |  password: "${DEMO_PASSWORD}"`
  );
}

// ---------------------------------------------------------------------------
// Past games + fake reviews/ratings  (idempotent — upserts, so text edits
// here also propagate to a DB that already has the rows)
// ---------------------------------------------------------------------------

const pastGames = [
  // --- Jia Min's reviewable games (she's a player, not host — within 7-day review window) ---
  {
    id: "game_past_4",
    title: "Mixed Beach 4s @ Siloso",
    type: "Beach", skill: "Intermediate",
    date: "2026-06-09", time: "10:00", end_time: "12:00",
    location: "Siloso Beach, Sentosa — Net 2", area: "Sentosa",
    total_slots: 8, host_id: "user_p1",
    notes: "Great vibes, sunny morning session.",
    roster: ["user_p1", "user_maria", "user_p6", "user_p7"],
  },
  {
    id: "game_past_5",
    title: "Evening Comp 6s @ OCBC Arena",
    type: "Indoor", skill: "Advanced",
    date: "2026-06-11", time: "19:30", end_time: "21:30",
    location: "OCBC Arena, Hall 2", area: "Kallang",
    total_slots: 10, host_id: "user_p4",
    notes: "Fast-paced competitive game. Score to 25.",
    roster: ["user_p4", "user_maria", "user_p8", "user_p9", "user_p10"],
  },
  {
    id: "game_past_6",
    title: "Grass Open Run @ West Coast",
    type: "Grass", skill: "All Levels",
    date: "2026-06-13", time: "11:00", end_time: "13:00",
    location: "West Coast Park, Grand Lawn", area: "West Coast",
    total_slots: 8, host_id: "user_p6",
    notes: "Casual grass game, all welcome.",
    roster: ["user_p6", "user_maria", "user_p7", "user_nina"],
  },
  // --- Older seeded games (outside 7-day review window) ---
  {
    id: "game_past_1",
    title: "Thursday Night 6s @ Bedok",
    type: "Indoor", skill: "Intermediate",
    date: "2026-06-05", time: "18:00", end_time: "20:00",
    location: "Bedok Sports Hall (ActiveSG), Court 1", area: "Bedok",
    total_slots: 12, host_id: "user_theo",
    notes: "Great competitive game. Rotate teams every set.",
    roster: ["user_theo", "user_maria", "user_p0", "user_p1", "user_p2", "user_p3"],
  },
  {
    id: "game_past_2",
    title: "Weekend Beach Tournament @ Siloso",
    type: "Beach", skill: "Advanced",
    date: "2026-06-08", time: "09:00", end_time: "13:00",
    location: "Siloso Beach, Sentosa — Main Courts", area: "Sentosa",
    total_slots: 8, host_id: "user_dre",
    notes: "High intensity tournament format. Bring your A-game.",
    roster: ["user_dre", "user_p13", "user_p14", "user_p15", "user_p16"],
  },
  {
    id: "game_past_3",
    title: "Sunday Beginner Open @ Clementi",
    type: "Indoor", skill: "Beginner",
    date: "2026-06-10", time: "14:00", end_time: "16:00",
    location: "Clementi Sports Hall (ActiveSG)", area: "Clementi",
    total_slots: 10, host_id: "user_grace",
    notes: "Friendly intro session. All skill welcome.",
    roster: ["user_grace", "user_nina", "user_p11", "user_p12"],
  },
  {
    id: "game_ratings_showcase",
    title: "Community Rating Day",
    type: "Indoor", skill: "All Levels",
    date: "2026-06-12", time: "10:00", end_time: "16:00",
    location: "Coterie Community Gym", area: "Singapore",
    total_slots: 30, host_id: "user_theo",
    notes: "Big mixed open session — everyone rated their teammates afterwards.",
    roster: ["user_maria", "user_theo", "user_grace", "user_dre", "user_nina"],
  },
];

// game_reviews: reviewer_id → rates the host of the game
const pastReviews = [
  // Thursday 6s @ Bedok (host: user_theo / Wei Jie)
  { id: "rev_past_1_1", game_id: "game_past_1", reviewer_id: "user_maria",  host_id: "user_theo",  rating: 5, comment: "Wei Jie ran a super smooth game. Great energy and fair rotations!" },
  { id: "rev_past_1_2", game_id: "game_past_1", reviewer_id: "user_p0",     host_id: "user_theo",  rating: 4, comment: "Good organization, would play again." },
  { id: "rev_past_1_3", game_id: "game_past_1", reviewer_id: "user_p1",     host_id: "user_theo",  rating: 5, comment: "One of the best pickup games I've been to." },
  { id: "rev_past_1_4", game_id: "game_past_1", reviewer_id: "user_p2",     host_id: "user_theo",  rating: 4, comment: "Started on time and the court was booked properly. 10/10." },
  // Beach Tournament (host: user_dre / Arjun)
  { id: "rev_past_2_1", game_id: "game_past_2", reviewer_id: "user_p13",    host_id: "user_dre",   rating: 5, comment: "Arjun knows how to run a competitive game. Incredible." },
  { id: "rev_past_2_2", game_id: "game_past_2", reviewer_id: "user_p14",    host_id: "user_dre",   rating: 5, comment: "Best beach tournament I've played in a while." },
  { id: "rev_past_2_3", game_id: "game_past_2", reviewer_id: "user_p15",    host_id: "user_dre",   rating: 4, comment: "Really well run. Brackets were fair." },
  // Sunday Beginner Open (host: user_grace / Aisyah)
  { id: "rev_past_3_1", game_id: "game_past_3", reviewer_id: "user_nina",   host_id: "user_grace", rating: 5, comment: "Aisyah is such a welcoming host. Perfect vibe for beginners." },
  { id: "rev_past_3_2", game_id: "game_past_3", reviewer_id: "user_p11",    host_id: "user_grace", rating: 5, comment: "Learned so much! Aisyah explained every drill clearly." },
  { id: "rev_past_3_3", game_id: "game_past_3", reviewer_id: "user_p12",    host_id: "user_grace", rating: 4, comment: "Super patient host. Really appreciated the beginner-friendly pace." },
];

// player_ratings: rater_id → rates rated_id for a specific game
const pastPlayerRatings = [
  // Thursday 6s @ Bedok — user_maria rates teammates
  { id: "pr_1_maria_p0",   game_id: "game_past_1", rater_id: "user_maria",  rated_id: "user_p0",    rating: 4 },
  { id: "pr_1_maria_p1",   game_id: "game_past_1", rater_id: "user_maria",  rated_id: "user_p1",    rating: 5 },
  { id: "pr_1_maria_theo", game_id: "game_past_1", rater_id: "user_maria",  rated_id: "user_theo",  rating: 5 },
  // user_p0 rates
  { id: "pr_1_p0_maria",   game_id: "game_past_1", rater_id: "user_p0",     rated_id: "user_maria", rating: 5 },
  { id: "pr_1_p0_theo",    game_id: "game_past_1", rater_id: "user_p0",     rated_id: "user_theo",  rating: 4 },
  // user_p1 rates
  { id: "pr_1_p1_maria",   game_id: "game_past_1", rater_id: "user_p1",     rated_id: "user_maria", rating: 5 },
  { id: "pr_1_p1_p2",      game_id: "game_past_1", rater_id: "user_p1",     rated_id: "user_p2",    rating: 3 },
  // user_p2 rates
  { id: "pr_1_p2_theo",    game_id: "game_past_1", rater_id: "user_p2",     rated_id: "user_theo",  rating: 5 },
  { id: "pr_1_p2_p1",      game_id: "game_past_1", rater_id: "user_p2",     rated_id: "user_p1",    rating: 4 },
  // user_theo rates
  { id: "pr_1_theo_maria", game_id: "game_past_1", rater_id: "user_theo",   rated_id: "user_maria", rating: 5 },
  { id: "pr_1_theo_p3",    game_id: "game_past_1", rater_id: "user_theo",   rated_id: "user_p3",    rating: 4 },

  // Beach Tournament
  { id: "pr_2_p13_dre",    game_id: "game_past_2", rater_id: "user_p13",    rated_id: "user_dre",   rating: 5 },
  { id: "pr_2_p13_p14",    game_id: "game_past_2", rater_id: "user_p13",    rated_id: "user_p14",   rating: 4 },
  { id: "pr_2_p14_dre",    game_id: "game_past_2", rater_id: "user_p14",    rated_id: "user_dre",   rating: 5 },
  { id: "pr_2_p14_p13",    game_id: "game_past_2", rater_id: "user_p14",    rated_id: "user_p13",   rating: 5 },
  { id: "pr_2_p15_dre",    game_id: "game_past_2", rater_id: "user_p15",    rated_id: "user_dre",   rating: 4 },
  { id: "pr_2_p15_p16",    game_id: "game_past_2", rater_id: "user_p15",    rated_id: "user_p16",   rating: 3 },
  { id: "pr_2_p16_p13",    game_id: "game_past_2", rater_id: "user_p16",    rated_id: "user_p13",   rating: 4 },
  { id: "pr_2_dre_p13",    game_id: "game_past_2", rater_id: "user_dre",    rated_id: "user_p13",   rating: 5 },
  { id: "pr_2_dre_p15",    game_id: "game_past_2", rater_id: "user_dre",    rated_id: "user_p15",   rating: 4 },

  // Sunday Beginner Open
  { id: "pr_3_nina_grace", game_id: "game_past_3", rater_id: "user_nina",   rated_id: "user_grace", rating: 5 },
  { id: "pr_3_nina_p11",   game_id: "game_past_3", rater_id: "user_nina",   rated_id: "user_p11",   rating: 3 },
  { id: "pr_3_p11_grace",  game_id: "game_past_3", rater_id: "user_p11",    rated_id: "user_grace", rating: 5 },
  { id: "pr_3_p11_nina",   game_id: "game_past_3", rater_id: "user_p11",    rated_id: "user_nina",  rating: 4 },
  { id: "pr_3_p12_grace",  game_id: "game_past_3", rater_id: "user_p12",    rated_id: "user_grace", rating: 5 },
  { id: "pr_3_p12_p11",    game_id: "game_past_3", rater_id: "user_p12",    rated_id: "user_p11",   rating: 4 },
  { id: "pr_3_grace_nina", game_id: "game_past_3", rater_id: "user_grace",  rated_id: "user_nina",  rating: 5 },
  { id: "pr_3_grace_p12",  game_id: "game_past_3", rater_id: "user_grace",  rated_id: "user_p12",   rating: 4 },
];

// 1@demo.test is the account used to walk people through the app, so its
// profile is pinned to strong-but-not-flawless rather than left to the hash —
// which had assigned it the worst numbers of the entire cast. Everyone else
// keeps the full spread; the point of the variation is lost if the account
// shown in demos is the least reliable one on the platform.
//
// Declared here rather than beside the other tuning constants further down:
// demoShowcaseRatings below is an IIFE that runs at module load, and `const`
// is not hoisted the way a function declaration is.
const SHOWCASE_USER = "user_maria";
const SHOWCASE_PARTICIPATION = 97;
const SHOWCASE_PEER_RATING = 4.7;
const SHOWCASE_HOST_RATING = 4.8;

// Teammate ratings for the demo cast. Everyone shares one synthetic past game
// ("game_ratings_showcase") and is rated by the others plus a pool of regulars.
//
// Each rated player gets their OWN target average rather than one shared
// pattern — an earlier version reused a single sequence for everybody, which
// left all five headline accounts sitting between 4.59 and 4.64 with an
// identical vote count. Believable data needs people who are merely fine, not
// a cast where everyone is equally excellent.
//
// The supporting cast (user_p*) are rated too, by a smaller pool, so their
// profiles aren't blank — several of them have 20+ past games.
const demoShowcaseRatings = (() => {
  const mains = ["user_maria", "user_theo", "user_grace", "user_dre", "user_nina"];
  const supporting = Array.from({ length: 24 }, (_, i) => `user_p${i}`);
  const raters = [...mains, ...supporting.slice(0, 21)];

  // Deliberately spread, including a couple of genuinely middling players.
  const TARGETS = [4.9, 4.1, 4.6, 3.8, 4.4, 4.75, 3.6, 4.25, 4.55, 4.0];

  const out = [];
  const rate = (ratedId, raterId, target) => {
    // Jitter of roughly ±1 around the target, so the spread of individual
    // votes looks human while the average lands near where we want it.
    const j = (hashStr(raterId + ratedId) % 200) / 100 - 1;
    return Math.max(1, Math.min(5, Math.round(target + j)));
  };

  for (const ratedId of mains) {
    const target = ratedId === SHOWCASE_USER ? SHOWCASE_PEER_RATING : TARGETS[hashStr(ratedId) % TARGETS.length];
    for (const raterId of raters) {
      if (raterId === ratedId) continue;
      out.push({
        id: `pr_show_${raterId}_${ratedId}`,
        game_id: "game_ratings_showcase",
        rater_id: raterId,
        rated_id: ratedId,
        rating: rate(ratedId, raterId, target),
      });
    }
  }
  // Supporting cast: 5-12 votes each, enough to look real without implying
  // they're as established as the headline accounts.
  for (const ratedId of supporting) {
    const target = TARGETS[hashStr(ratedId + "s") % TARGETS.length];
    const n = 5 + (hashStr(ratedId + "n") % 8);
    const pool = raters.filter((r) => r !== ratedId);
    for (let i = 0; i < n; i++) {
      const raterId = pool[(hashStr(ratedId + i) % pool.length)];
      if (raterId === ratedId) continue;
      out.push({
        id: `pr_show_${raterId}_${ratedId}`,
        game_id: "game_ratings_showcase",
        rater_id: raterId,
        rated_id: ratedId,
        rating: rate(ratedId, raterId, target),
      });
    }
  }
  // Static ids mean duplicates collapse; de-dupe so the INSERT doesn't carry
  // the same primary key twice within one batch.
  const seen = new Set();
  return out.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
})();

/** Idempotent — upserts past games, host reviews, and player ratings. Safe to
 *  call repeatedly; text changes above overwrite existing seeded rows. */
export async function seedPastData() {
  const now = new Date().toISOString();

  for (const g of pastGames) {
    await query(
      `INSERT INTO games
         (id, title, type, skill, date, time, end_time, location, area, total_slots, pre_filled, host_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, location = EXCLUDED.location,
         area = EXCLUDED.area, notes = EXCLUDED.notes`,
      [g.id, g.title, g.type, g.skill, g.date, g.time, g.end_time,
       g.location, g.area, g.total_slots, g.host_id, g.notes, now]
    );
    let seq = 0;
    for (const entry of g.roster) {
      const userId = resolveUserId(entry);
      if (userId) {
        await query(
          `INSERT INTO game_members (game_id, user_id, status, seq)
           VALUES ($1, $2, 'player', $3) ON CONFLICT DO NOTHING`,
          [g.id, userId, seq]
        );
        seq += 1;
      }
    }
  }

  for (const r of pastReviews) {
    await query(
      `INSERT INTO game_reviews (id, game_id, reviewer_id, host_id, rating, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (game_id, reviewer_id) DO UPDATE SET
         rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
      [r.id, r.game_id, r.reviewer_id, r.host_id, r.rating, r.comment, now]
    );
  }

  for (const pr of [...pastPlayerRatings, ...demoShowcaseRatings]) {
    await query(
      `INSERT INTO player_ratings (id, game_id, rater_id, rated_id, rating, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (game_id, rater_id, rated_id) DO NOTHING`,
      [pr.id, pr.game_id, pr.rater_id, pr.rated_id, pr.rating, now]
    );
  }

  console.log(
    `[seed] seedPastData: ${pastGames.length} past games, ` +
    `${pastReviews.length} host reviews, ${pastPlayerRatings.length + demoShowcaseRatings.length} player ratings`
  );
}

// ---------------------------------------------------------------------------
// Engagement data — chat, comments, reviews, stars
//
// The tables above only cover the hand-written games declared in this file.
// Most games in the DB are generated with random ids, so they can't be listed
// here statically — this section reads whatever demo-hosted games actually
// exist and fills their chat/comments/reviews. That's what makes profiles read
// as "active for a long time" rather than freshly seeded.
//
// Idempotent: every row id is derived from (game id + index), so re-running
// inserts nothing new. Deterministic: content is chosen by hashing that same
// id, so a given game always gets the same conversation.
// ---------------------------------------------------------------------------

const DEMO_HOST_IDS = ["user_maria", "user_theo", "user_grace", "user_dre", "user_nina"];

// Target average star rating per host, assigned by hash. Spread on purpose:
// a well-run game and a shambolic one should not look identical on a profile.
const HOST_RATING_TARGETS = [4.85, 4.1, 4.5, 3.9, 4.65];

// Target participation percentages, assigned per player. 100 exists (some
// people genuinely never bail) but most sit lower, which is what makes the
// number worth reading at all.
const PARTICIPATION_TARGETS = [100, 97, 93, 100, 88, 82, 95, 76, 90, 85];

/** Stable 32-bit hash — same string always picks the same pool entry. */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}
const pick = (arr, key) => arr[hashStr(key) % arr.length];

// Chat opens with the host, then players reply. Kept generic (no venue/date
// specifics) so one pool reads naturally on any game.
const HOST_OPENERS = [
  "Court's confirmed! See everyone there 🏐",
  "All set for this one. Bring a light and a dark shirt if you have both.",
  "Booked and paid. Shout if you can't make it so I can free the slot.",
  "We're on! Warmup starts 10 min before, don't be shy if you're early.",
  "Nets are sorted. Looking forward to this one 🙌",
];
// Statements only — anything that asks something lives in CHAT_QA below, so a
// question is never left hanging without the host answering it.
const PLAYER_LINES = [
  "Nice, count me in!",
  "Just booked my Grab, should be there 10 min early.",
  "Anyone coming from the east side? Happy to carpool.",
  "Can't wait, been looking forward to this all week.",
  "Might be 5 min late, coming straight from work 🙏",
  "Weather's looking good for once!",
  "I'll bring an extra ball just in case.",
  "Great session last time, hoping for the same crowd.",
  "Stretching beforehand this time, last week wrecked me 😅",
  "See everyone there!",
];
// A player question and the host's answer to it, kept together.
const CHAT_QA = [
  { q: "First time at this venue — is parking easy?",
    a: "Parking's easy, plenty of space on the ground floor." },
  { q: "Do we need to bring our own ball or is it provided?",
    a: "Balls are provided, just bring yourself 👍" },
  { q: "Bringing a friend if there's still a slot going?",
    a: "Yes there's still room, bring them along!" },
  { q: "Is there a water cooler there or should I pack my own?",
    a: "Water cooler's on site but pack a bottle to be safe." },
  { q: "What time should we actually turn up?",
    a: "Anytime from 10 min before — we'll be warming up." },
];
const WRAP_LINES = [
  "Great games today everyone, same time next week? 🏐",
  "Thanks for coming out, that last set was unreal.",
  "Good session! Someone left a black water bottle, I've got it.",
  "That was a fun one. See you all at the next.",
  "Solid turnout today, appreciate everyone showing up on time.",
];

// Comments are public (pre-join questions), so they read differently to chat.
// Paired so the host's reply actually answers the question above it — picking
// question and answer from two independent pools produced exchanges like
// "Is it indoor shoes only?" → "All levels welcome!".
const COMMENT_QA = [
  { q: "Is this beginner friendly or more competitive?",
    a: "All levels welcome, we rotate so everyone gets court time!" },
  { q: "Any slots left for a +1?",
    a: "Yep, a couple of spots free — grab them while they last." },
  { q: "What's the parking situation like?",
    a: "Parking's right next to the hall, never had an issue." },
  { q: "Do you usually play 6v6 or rotate smaller teams?",
    a: "6v6 mostly, but we go smaller if turnout is light." },
  { q: "Is it indoor shoes only?",
    a: "Indoor shoes please, keeps the court in good shape 🙏" },
  { q: "How early should I turn up?",
    a: "10 minutes before is plenty — we warm up together." },
];
// Standalone follow-ups that read fine without a reply under them.
const COMMENT_FOLLOWUPS = [
  "Been meaning to join one of these — adding myself to the list!",
  "Joined, looking forward to it!",
  "Count me in for this one 🏐",
  "Just signed up, first time playing with this group.",
];

const REVIEW_COMMENTS = [
  "Really well organised, started right on time.",
  "Great host — clear comms and a friendly crowd.",
  "Good mix of skill levels, everyone got plenty of court time.",
  "Smooth session from start to finish. Would join again.",
  "Court was booked properly and the rotations were fair.",
  "Welcoming vibe, easy to slot in even as a newcomer.",
  "Really enjoyed this one, great energy throughout.",
  "Solid session. Host kept things moving nicely.",
];

/** Chunked multi-row INSERT — keeps startup to a few queries, not thousands. */
async function bulkInsert(table, columns, rows, conflict) {
  if (rows.length === 0) return 0;
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk
      .map((_, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(", ")})`)
      .join(", ");
    const { rowCount } = await query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values} ${conflict}`,
      chunk.flat()
    );
    inserted += rowCount;
  }
  return inserted;
}

/**
 * Fills chat, comments, host reviews and stars across every demo-hosted game.
 * Runs on every startup after seedPastData(); safe to re-run.
 */
export async function seedEngagement() {
  const nowMs = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const DAY = 86400000;

  // 1. Backdate demo tenure. Everything was created in one seeding run, so all
  // 29 accounts share a "member since" date — which reads as a brand-new app.
  // Spread them 6-20 months back instead, deterministic by index so the dates
  // don't drift on every boot. Only touches accounts still on the original
  // seeded timestamp, so a manual edit later isn't overwritten.
  const { rows: demoRows } = await query(
    "SELECT id FROM users WHERE email LIKE '%@demo.test' ORDER BY id"
  );
  for (let i = 0; i < demoRows.length; i++) {
    const monthsBack = 6 + ((hashStr(demoRows[i].id) % 15)); // 6-20 months
    const jitterDays = hashStr(demoRows[i].id + "d") % 28;
    const created = iso(nowMs - monthsBack * 30 * DAY - jitterDays * DAY);
    await query(
      "UPDATE users SET created_at = $1 WHERE id = $2 AND created_at > $1",
      [created, demoRows[i].id]
    );
  }

  // 2. Fill rosters. Most demo games were created with only the host on them,
  // which makes every game read as "nobody joined" AND starves everything
  // below — an empty roster means no one to chat, no one to review the host.
  // Fill each to 50-90% of its slots (never over) with demo accounts.
  const { rows: allDemo } = await query(
    "SELECT id FROM users WHERE email LIKE '%@demo.test' ORDER BY id"
  );
  const demoIds = allDemo.map((r) => r.id);
  const demoSet = new Set(demoIds);
  const { rows: rosters } = await query(
    `SELECT g.id, g.host_id, g.total_slots,
            COALESCE(array_agg(gm.user_id) FILTER (WHERE gm.user_id IS NOT NULL), '{}') AS members,
            COALESCE(MAX(gm.seq), -1) AS max_seq
       FROM games g
       LEFT JOIN game_members gm ON gm.game_id = g.id
      WHERE g.host_id = ANY($1)
      GROUP BY g.id`,
    [DEMO_HOST_IDS]
  );
  const newMembers = [];
  for (const g of rosters) {
    const members = g.members || [];
    const fillFrac = 0.5 + (hashStr(g.id + "f") % 41) / 100; // 0.50-0.90
    const target = Math.min(g.total_slots, Math.round(g.total_slots * fillFrac));
    const need = target - members.length;
    if (need <= 0) continue;
    // Deterministic per-game ordering so the same players always land here.
    const candidates = demoIds
      .filter((u) => !members.includes(u))
      .sort((a, b) => hashStr(g.id + a) - hashStr(g.id + b));
    candidates.slice(0, need).forEach((uid, i) => {
      newMembers.push([g.id, uid, "player", Number(g.max_seq) + 1 + i]);
    });
  }
  const mem = await bulkInsert("game_members", ["game_id", "user_id", "status", "seq"],
    newMembers, "ON CONFLICT DO NOTHING");

  // 3. Re-read with the filled rosters so chat/reviews below use real players.
  const { rows: games } = await query(
    `SELECT g.id, g.host_id, g.date, g.time,
            array_agg(gm.user_id ORDER BY gm.seq) AS members
       FROM games g
       JOIN game_members gm ON gm.game_id = g.id
      WHERE g.host_id = ANY($1)
      GROUP BY g.id`,
    [DEMO_HOST_IDS]
  );

  const messages = [];
  const comments = [];
  const reviews = [];
  const interest = [];

  for (const g of games) {
    const members = (g.members || []).filter(Boolean);
    if (members.length === 0) continue;
    // Authors are demo accounts ONLY. Real testers do join these games, and
    // putting invented chat messages or host reviews in a real person's name
    // would be misattribution, not seed data.
    const others = members.filter((m) => m !== g.host_id && demoSet.has(m));
    const startMs = new Date(`${g.date}T${(g.time || "18:00")}:00Z`).getTime();
    if (!Number.isFinite(startMs)) continue;

    // Chatter builds in the days before the game, then a wrap-up after it.
    // Anything that would land in the future is skipped, so far-off games are
    // quiet and past games have full threads — the same shape real activity
    // has, without needing per-game tuning. (Deliberately NOT clamped to the
    // game's created_at: these games were inserted retroactively with dates in
    // the past, and nothing in the UI exposes games.created_at anyway.)
    const chatQa = pick(CHAT_QA, g.id + "cq");
    // Step by 3 through a 10-entry pool (coprime, so 4 picks never repeat) —
    // picking each independently by hash would sometimes say the same line
    // twice in one thread.
    const plBase = hashStr(g.id) % PLAYER_LINES.length;
    const pl = (n) => PLAYER_LINES[(plBase + n * 3) % PLAYER_LINES.length];
    const beats = [
      { at: startMs - 12 * DAY, who: "host", text: pick(HOST_OPENERS, g.id + "0") },
      { at: startMs - 8 * DAY, who: "player", text: pl(0) },
      { at: startMs - 5 * DAY, who: "player", text: chatQa.q },
      { at: startMs - 4 * DAY, who: "host", text: chatQa.a },
      { at: startMs - 2 * DAY, who: "player", text: pl(1) },
      { at: startMs - 1 * DAY, who: "player", text: pl(2) },
      { at: startMs - 5 * 3600000, who: "player", text: pl(3) },
      { at: startMs + 3 * 3600000, who: "host", text: pick(WRAP_LINES, g.id + "7") },
    ];
    beats.forEach((b, i) => {
      if (b.at > nowMs) return;
      const author = b.who === "host"
        ? g.host_id
        : others.length ? others[hashStr(g.id + i) % others.length] : g.host_id;
      messages.push([
        `msg_seed_${g.id}_${i}`, g.id, author, b.text, iso(b.at),
      ]);
    });

    // Public questions on the game page, answered by the host. The Q and its
    // answer come from one paired entry so the exchange reads coherently.
    const qa = pick(COMMENT_QA, g.id + "qa");
    const commentBeats = [
      { at: startMs - 10 * DAY, who: "player", text: qa.q },
      { at: startMs - 10 * DAY + 3600000, who: "host", text: qa.a },
      { at: startMs - 6 * DAY, who: "player", text: pick(COMMENT_FOLLOWUPS, g.id + "cf") },
    ];
    commentBeats.forEach((b, i) => {
      if (b.at > nowMs) return;
      const author = b.who === "host"
        ? g.host_id
        : others.length ? others[hashStr(g.id + "c" + i) % others.length] : g.host_id;
      comments.push([
        `cmt_seed_${g.id}_${i}`, g.id, author, b.text, iso(b.at),
      ]);
    });

    // Host reviews — only for games that have actually finished, and only from
    // players (never the host reviewing themselves). About two thirds of the
    // roster leaves one, which is generous but not implausible.
    if (startMs < nowMs) {
      // Each host has their own standing, so reviews cluster around a target
      // rather than everyone landing in the high 4s. Hosts genuinely differ —
      // a dashboard where every host is ~4.8 tells you nothing.
      const hostTarget = g.host_id === SHOWCASE_USER
        ? SHOWCASE_HOST_RATING
        : HOST_RATING_TARGETS[hashStr(g.host_id) % HOST_RATING_TARGETS.length];
      others.forEach((uid, i) => {
        if (hashStr(g.id + uid) % 3 === 0) return; // ~1 in 3 doesn't review
        const j = (hashStr(uid + g.id) % 200) / 100 - 1; // ±1 around the target
        const rating = Math.max(1, Math.min(5, Math.round(hostTarget + j)));
        reviews.push([
          `rev_seed_${g.id}_${i}`, g.id, uid, g.host_id, rating,
          pick(REVIEW_COMMENTS, g.id + uid), iso(startMs + 6 * 3600000),
        ]);
      });
    } else {
      // Upcoming games get starred by demo users who aren't already playing.
      DEMO_HOST_IDS.filter((u) => !members.includes(u)).forEach((uid) => {
        if (hashStr(g.id + uid + "i") % 3 !== 0) return;
        interest.push([g.id, uid]);
      });
    }
  }

  // 6. Participation variation. Without dropouts every profile reads a flat
  // 100%, which makes the reliability stat look decorative. Each demo player
  // gets a target rate and enough late bails to land near it.
  //
  // Bails are recorded ONLY on past games the player is not currently on the
  // roster of — which is the truthful shape of the data (they left, so they're
  // not a member) and also avoids counting one game as both attended and
  // bailed, which would understate the rate.
  const today = new Date().toISOString().slice(0, 10);
  const { rows: pastRows } = await query(
    `SELECT gm.user_id, gm.game_id
       FROM game_members gm
       JOIN games g ON g.id = gm.game_id
      WHERE g.host_id = ANY($1) AND g.date < $2 AND gm.status = 'player'`,
    [DEMO_HOST_IDS, today]
  );
  const { rows: pastGameRows } = await query(
    `SELECT id, date, time FROM games
      WHERE host_id = ANY($1) AND date < $2 ORDER BY id`,
    [DEMO_HOST_IDS, today]
  );
  const attendedBy = new Map();
  for (const row of pastRows) {
    if (!attendedBy.has(row.user_id)) attendedBy.set(row.user_id, new Set());
    attendedBy.get(row.user_id).add(row.game_id);
  }

  const dropouts = [];
  for (const uid of demoIds) {
    const attended = attendedBy.get(uid)?.size ?? 0;
    if (attended < 5) continue; // too little history for a rate to mean anything
    const target = uid === SHOWCASE_USER
      ? SHOWCASE_PARTICIPATION
      : PARTICIPATION_TARGETS[hashStr(uid + "p") % PARTICIPATION_TARGETS.length];
    if (target >= 100) continue;
    // attended / (attended + bails) = target/100  →  solve for bails
    const bails = Math.round((attended * (100 - target)) / target);
    if (bails < 1) continue;
    const candidates = pastGameRows
      .filter((g) => !attendedBy.get(uid).has(g.id))
      .sort((a, b) => hashStr(uid + a.id) - hashStr(uid + b.id))
      .slice(0, bails);
    for (const g of candidates) {
      const startMs = new Date(`${g.date}T${g.time || "18:00"}:00Z`).getTime();
      const hoursBefore = 2 + (hashStr(uid + g.id + "h") % 20); // 2-21h → always late
      dropouts.push([
        g.id, uid,
        iso(Number.isFinite(startMs) ? startMs - hoursBefore * 3600000 : nowMs),
        hoursBefore, true,
      ]);
    }
  }

  const m = await bulkInsert("messages", ["id", "game_id", "user_id", "body", "created_at"],
    messages, "ON CONFLICT (id) DO NOTHING");
  const c = await bulkInsert("game_comments", ["id", "game_id", "user_id", "body", "created_at"],
    comments, "ON CONFLICT (id) DO NOTHING");
  const r = await bulkInsert("game_reviews",
    ["id", "game_id", "reviewer_id", "host_id", "rating", "comment", "created_at"],
    reviews, "ON CONFLICT (game_id, reviewer_id) DO NOTHING");
  const s = await bulkInsert("game_interest", ["game_id", "user_id"],
    interest, "ON CONFLICT DO NOTHING");
  const d = await bulkInsert("game_dropouts",
    ["game_id", "user_id", "left_at", "hours_before", "late"],
    dropouts, "ON CONFLICT (game_id, user_id) DO NOTHING");

  if (mem + m + c + r + s + d > 0) {
    console.log(
      `[seed] seedEngagement: +${mem} roster spots, +${m} messages, ` +
      `+${c} comments, +${r} reviews, +${s} stars, +${d} dropouts`
    );
  }
}
