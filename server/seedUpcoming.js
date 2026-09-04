/**
 * Upcoming-games seed — the demo data behind Browse.
 *
 * Why this exists: as of 2026-09-04 the production database held 93 past games
 * and **zero** upcoming ones, so Browse was empty for every account. That makes
 * the app impossible to demo and impossible to test the join → pay → chat path
 * against. This file fills September–October 2026 with 20 games at real
 * Singapore venues.
 *
 * Rules it follows, all of which matter:
 *
 * - **Fixed ids** (`game_up_1` … `game_up_20`) and `ON CONFLICT DO NOTHING`, so
 *   running it on every boot is free and never duplicates.
 * - **Fixed dates**, not offsets from today. An offset would silently shuffle
 *   every game on each deploy, and a player who joined "Thursday at Bedok"
 *   would find it had moved.
 * - **Deterministic randomisation** via `rand()` below — the spread of skills,
 *   costs, rosters and paid flags looks random but is identical on every run,
 *   so what Aidan sees in the simulator is what a tester sees on the web.
 * - **Venues come from the same list as `src/lib/courts.ts`**, with the region
 *   and area that file assigns them. A venue string the picker doesn't
 *   recognise would break Browse's region filter.
 *
 * `game_up_3` is deliberately hosted by Jia Min (`user_maria`, `1@demo.test`)
 * with a half-paid roster — that is the account used to demo the host's
 * payment list.
 *
 * To retire this before launch: stop calling `seedUpcomingGames()` in
 * `server/index.js`'s `start()`, and delete rows where `id LIKE 'game_up_%'`.
 */

import { query } from "./db.js";

/**
 * Deterministic PRNG (mulberry32). Seeded once per call so the "random" spread
 * of rosters and paid flags is stable across runs — see the file header.
 */
function makeRand(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every demo player who can fill a roster, excluding nobody — hosts included. */
const PLAYER_POOL = [
  "user_maria", "user_theo", "user_grace", "user_dre", "user_nina",
  "user_p0", "user_p1", "user_p2", "user_p3", "user_p4", "user_p5",
  "user_p6", "user_p7", "user_p8", "user_p9", "user_p10", "user_p11",
  "user_p12", "user_p13", "user_p14", "user_p15", "user_p16", "user_p17",
  "user_p18", "user_p19", "user_p20", "user_p21", "user_p22", "user_p23",
];

/**
 * The 20 games. `location`/`area`/`region` are copied from `src/lib/courts.ts`
 * — primary region first, exactly as `CourtPicker` would have filled them in,
 * so the Region filter on Browse finds these games.
 *
 * `fill` is the fraction of slots taken before anyone real joins; leaving a few
 * games nearly full and one genuinely full is what makes the waitlist path
 * demoable.
 */
const UPCOMING = [
  {
    id: "game_up_1", host: "user_p0",
    title: "Friday Night 6s @ Bedok",
    type: "Indoor", skill: "Low Intermediate", gender: "Open",
    date: "2026-09-11", time: "19:30", endTime: "21:30",
    location: "Bedok Sport Hall, Court 2", area: "Bedok", region: "East",
    slots: 12, cost: 8, rotation: "Standard", net: "Venue Standard",
    positions: [], fill: 0.66,
    notes: "Court's booked and paid for. Rotating teams every two sets so everyone gets time on. PayNow me on the day.",
  },
  {
    id: "game_up_2", host: "user_grace",
    title: "Sunday Beginner Social @ Toa Payoh",
    type: "Indoor", skill: "Low Beginner", gender: "Open",
    date: "2026-09-13", time: "10:00", endTime: "12:00",
    location: "Toa Payoh Sport Hall", area: "Toa Payoh", region: "Central",
    slots: 14, cost: 6, rotation: "Standard", net: "Mixed (2.35m)",
    positions: ["Any"], fill: 0.5,
    notes: "Genuinely for first-timers. We spend the first 20 minutes on passing and serving, then play. No experience needed and nobody gets benched.",
  },
  {
    // Jia Min hosts this one — it is the account used to demo the payment list.
    id: "game_up_3", host: "user_maria",
    title: "Thursday Night 6s @ Sengkang",
    type: "Indoor", skill: "High Beginner", gender: "Open",
    date: "2026-10-01", time: "20:00", endTime: "22:00",
    location: "Sengkang Sport Hall, Court 4", area: "Sengkang", region: "North",
    slots: 12, cost: 9, rotation: "Standard", net: "Venue Standard",
    positions: ["Setter"], fill: 0.83,
    notes: "Regular Thursday slot. $9 covers the court and two new balls — PayNow me and I'll tick you off the list. Short a setter this week.",
  },
  {
    id: "game_up_4", host: "user_theo",
    title: "Saturday Beach 4s @ Sports Hub",
    type: "Beach", skill: "High Intermediate", gender: "Open",
    date: "2026-10-03", time: "16:00", endTime: "19:00",
    location: "Sports Hub Beach Volleyball Courts", area: "Kallang", region: "Central",
    slots: 8, cost: 5, rotation: "King of the Court", net: "Mixed (2.35m)",
    positions: [], fill: 0.75,
    notes: "King of the court, winners stay on. Sand gets hot until about 5 so bring water. Every level welcome but expect fast rallies.",
  },
  {
    id: "game_up_5", host: "user_p1",
    title: "Wednesday Open Play @ Jurong East",
    type: "Indoor", skill: "All Levels", gender: "Open",
    date: "2026-10-07", time: "19:00", endTime: "21:00",
    location: "Jurong East Sport Hall, Court 1", area: "Jurong East", region: "West",
    slots: 16, cost: 7, rotation: "Standard", net: "Venue Standard",
    positions: ["Any"], fill: 0.44,
    notes: "Biggest court we can get in the west. Mixed levels, we split teams to even things out rather than stacking one side.",
  },
  {
    id: "game_up_6", host: "user_dre",
    title: "Sunday Competitive 6s @ OCBC Arena",
    type: "Indoor", skill: "Advanced", gender: "Open",
    date: "2026-10-04", time: "14:00", endTime: "17:00",
    location: "OCBC Arena (The Kallang)", area: "Kallang", region: "Central",
    slots: 12, cost: 14, rotation: "Round Robin", net: "Men's (2.43m)",
    positions: ["Opposite", "Middle Blocker"], fill: 0.92,
    notes: "Fast, structured play — we run positions properly and keep score. Best if you've played league or school team. Court is $14 a head because it's the Arena.",
  },
  {
    id: "game_up_7", host: "user_nina",
    title: "Tuesday Ladies' Night @ Clementi",
    type: "Indoor", skill: "All Levels", gender: "Women",
    date: "2026-10-06", time: "19:30", endTime: "21:30",
    location: "Clementi Sport Hall, Court 2", area: "Clementi", region: "West",
    slots: 12, cost: 7, rotation: "Standard", net: "Women's (2.24m)",
    positions: ["Any"], fill: 0.58,
    notes: "Women's session, every level. Half the group started this year — if you've never played, this is the easiest place to start.",
  },
  {
    id: "game_up_8", host: "user_p4",
    title: "Friday Sunset Beach @ Siloso",
    type: "Beach", skill: "All Levels", gender: "Open",
    date: "2026-10-09", time: "17:00", endTime: "19:30",
    location: "Siloso Beach", area: "Sentosa", region: "South",
    slots: 10, cost: 0, rotation: "King of the Court", net: "Mixed (2.35m)",
    positions: [], fill: 0.6,
    notes: "Free — we bring our own net and post it up near the far end. Sentosa entry by bus or the boardwalk. Stay for food after if you like.",
  },
  {
    id: "game_up_9", host: "user_p13",
    title: "Monday Night 6s @ Hougang",
    type: "Indoor", skill: "Low Intermediate", gender: "Open",
    date: "2026-10-12", time: "20:00", endTime: "22:00",
    location: "Hougang Sport Hall", area: "Hougang", region: "North",
    slots: 12, cost: 8, rotation: "Standard", net: "Venue Standard",
    positions: ["Libero"], fill: 0.75,
    notes: "Start the week with a sweat. We keep it social but everybody rotates through every position, including serve receive.",
  },
  {
    id: "game_up_10", host: "user_p8",
    title: "Wednesday 6s @ Our Tampines Hub",
    type: "Indoor", skill: "High Beginner", gender: "Open",
    date: "2026-10-14", time: "19:00", endTime: "21:00",
    location: "Our Tampines Hub Sport Hall, Court 3", area: "Tampines", region: "East",
    slots: 14, cost: 8, rotation: "Standard", net: "Mixed (2.35m)",
    positions: ["Setter", "Any"], fill: 0.5,
    notes: "Easy to reach — the hall is right on top of Tampines MRT. Good session if you've played a handful of times and want more court time.",
  },
  {
    id: "game_up_11", host: "user_p15",
    title: "Saturday Morning 6s @ Yishun",
    type: "Indoor", skill: "Low Intermediate", gender: "Open",
    date: "2026-10-17", time: "09:00", endTime: "11:00",
    location: "Yishun Sport Hall", area: "Yishun", region: "North",
    slots: 12, cost: 7, rotation: "Standard", net: "Venue Standard",
    positions: [], fill: 0.33,
    notes: "Early start so you get your whole Saturday back. Aircon hall, so no excuses about the heat.",
  },
  {
    id: "game_up_12", host: "user_p6",
    title: "Sunday Grass 4s @ Bishan",
    type: "Grass", skill: "All Levels", gender: "Open",
    date: "2026-10-18", time: "08:30", endTime: "10:30",
    location: "Bishan Sport Hall", area: "Bishan", region: "Central",
    slots: 8, cost: 0, rotation: "King of the Court", net: "Mixed (2.35m)",
    positions: [], fill: 0.5,
    notes: "Free and casual on the grass outside. Bring water and sunscreen — there's no shade once the sun is up.",
  },
  {
    id: "game_up_13", host: "user_p17",
    title: "Friday Advanced 6s @ NTU",
    type: "Indoor", skill: "High Intermediate", gender: "Open",
    date: "2026-10-16", time: "20:00", endTime: "22:00",
    location: "NTU Sports Hall", area: "Jurong West", region: "West",
    slots: 12, cost: 10, rotation: "Round Robin", net: "Men's (2.43m)",
    positions: ["Outside Hitter"], fill: 0.83,
    notes: "Campus hall, gate opens at 19:45. Structured six-on-six with proper rotation. Come warmed up, we start on time.",
  },
  {
    id: "game_up_14", host: "user_p19",
    title: "Tuesday Beginner Clinic @ Woodlands",
    type: "Indoor", skill: "Low Beginner", gender: "Open",
    date: "2026-10-20", time: "19:30", endTime: "21:00",
    location: "Woodlands Sport Hall", area: "Woodlands", region: "North",
    slots: 12, cost: 6, rotation: "Standard", net: "Mixed (2.35m)",
    positions: ["Any"], fill: 0.42,
    notes: "First 30 minutes is drills — passing, setting, serving — then games. Turn up alone, you'll leave knowing everyone.",
  },
  {
    id: "game_up_15", host: "user_p10",
    title: "Thursday 6s @ Pasir Ris",
    type: "Indoor", skill: "Low Intermediate", gender: "Open",
    date: "2026-10-22", time: "20:00", endTime: "22:00",
    location: "Pasir Ris Sport Hall, Court 1", area: "Pasir Ris", region: "East",
    slots: 12, cost: 8, rotation: "Standard", net: "Venue Standard",
    positions: [], fill: 0.67,
    notes: "Regular east-side crew, been running this slot since March. Newcomers get folded straight in, no cliques.",
  },
  {
    id: "game_up_16", host: "user_p20",
    title: "Saturday Beach 4s @ East Coast Park",
    type: "Beach", skill: "Low Intermediate", gender: "Open",
    date: "2026-10-24", time: "16:30", endTime: "19:00",
    location: "East Coast Park Beach Volleyball Courts", area: "East Coast", region: "East",
    slots: 8, cost: 4, rotation: "King of the Court", net: "Mixed (2.35m)",
    positions: [], fill: 0.88,
    notes: "$4 covers the net rental split between us. Park at C4, courts are a two-minute walk. Dinner at the hawker centre after if people are up for it.",
  },
  {
    id: "game_up_17", host: "user_p22",
    title: "Sunday Mixed 6s @ Serangoon",
    type: "Indoor", skill: "High Beginner", gender: "Mixed",
    date: "2026-10-25", time: "15:00", endTime: "17:00",
    location: "Serangoon Sport Hall", area: "Serangoon", region: "North",
    slots: 12, cost: 7, rotation: "Standard", net: "Mixed (2.35m)",
    positions: ["Middle Blocker", "Any"], fill: 0.58,
    notes: "Mixed teams, minimum two women on court each side. Relaxed pace, we call our own lines and nobody argues about it.",
  },
  {
    id: "game_up_18", host: "user_p11",
    title: "Wednesday Night 6s @ Bukit Gombak",
    type: "Indoor", skill: "All Levels", gender: "Open",
    date: "2026-10-21", time: "19:30", endTime: "21:30",
    location: "Bukit Gombak Sport Hall", area: "Bukit Batok", region: "West",
    slots: 14, cost: 7, rotation: "Standard", net: "Venue Standard",
    positions: ["Any"], fill: 0.36,
    notes: "Plenty of room this week. All levels genuinely means all levels — we split so the sides stay even.",
  },
  {
    id: "game_up_19", host: "user_p3",
    title: "Friday 6s @ Yio Chu Kang",
    type: "Indoor", skill: "Low Intermediate", gender: "Open",
    date: "2026-10-30", time: "20:00", endTime: "22:00",
    location: "Yio Chu Kang Sport Hall, Court 2", area: "Yio Chu Kang", region: "North",
    slots: 12, cost: 8, rotation: "Standard", net: "Venue Standard",
    positions: [], fill: 0.5,
    notes: "Last Friday of the month, we usually go for supper after at the coffee shop across the road.",
  },
  {
    id: "game_up_20", host: "user_p7",
    title: "Saturday Competitive 6s @ MOE (Evans)",
    type: "Indoor", skill: "Advanced", gender: "Open",
    date: "2026-10-31", time: "10:00", endTime: "13:00",
    location: "MOE (Evans) Sport Hall, Court 1", area: "Evans Road", region: "Central",
    slots: 12, cost: 11, rotation: "Round Robin", net: "Men's (2.43m)",
    positions: ["Opposite"], fill: 1.0,
    notes: "Full for now — join the waitlist and you'll be moved in automatically the moment someone drops. Competitive pace, we run a proper 5-1.",
  },
];

/**
 * Opening messages for each game's chat, so the Chats tab isn't a list of empty
 * rooms. Sent by the host and the first couple of players who joined.
 */
const CHAT_OPENERS = [
  ["Court's confirmed. See everyone there — come 10 minutes early if you can so we start on time.", "Nice, first time at this hall for me. Anything I should know?", "Just bring indoor shoes, the floor's slippery in socks."],
  ["Hi all, welcome. If it's your first session just say hi here and someone will look out for you on the day.", "First timer here, slightly nervous but looking forward to it", "You'll be fine, half of us started this year"],
  ["Court booked. $9 each — PayNow me and I'll tick you off the list here.", "Transferred, thanks Jia Min", "Sent!", "Can I pay on the day? Left my phone at work", "Of course, no rush."],
  ["Sand courts confirmed for 4pm. Bring water, it's brutal until about 5.", "I'll bring a spare ball", "Legend"],
  ["We're on. Plenty of space this week so bring a friend if you like.", "Bringing my flatmate, he's played twice"],
  ["Arena's booked. Warm up before we start, we only have the court for three hours.", "On it", "Anyone driving from the east?", "I am, can take two"],
  ["Ladies' night is on. Every level — genuinely, don't be shy.", "First session for me!", "Welcome!! You'll love it"],
  ["Net's in my car, I'll set up from 4.45. Free session, just turn up.", "Can help set up if you're there early"],
  ["Booked. Short a libero this week if anyone knows someone.", "I can play libero", "Perfect, you're in"],
  ["Hall is right on top of the MRT so no excuses. See you Wednesday.", "Easiest commute of the week"],
  ["Early one — 9am start, you'll have your whole Saturday after.", "Best kind of session"],
  ["Grass session on as long as it's dry. I'll post here by 7am if we're rained out.", "Fingers crossed"],
  ["Gate opens 7.45pm. We start on the hour, come warm.", "Noted", "Parking on campus is free after 7"],
  ["Drills first half hour then games. Zero experience needed.", "This is exactly what I was looking for", "Same, see you there"],
  ["Same crew, same slot. New faces very welcome.", "Joining for the first time this week", "Welcome aboard"],
  ["$4 each for the net rental. Park at C4, we're two minutes' walk from there.", "Sent the $4", "Thanks!"],
  ["Mixed teams, minimum two women a side. Relaxed pace.", "Sounds good, in"],
  ["Loads of room this week, bring whoever.", "Bringing two colleagues who've never played"],
  ["Last Friday of the month — supper after at the coffee shop opposite, as usual.", "Wouldn't miss it"],
  ["We're full but the waitlist moves — people drop most weeks.", "On the waitlist, fingers crossed", "You'll almost certainly get in"],
];

export async function seedUpcomingGames() {
  // Cheap guard: if every game is already there, do nothing at all.
  const { rows } = await query(
    "SELECT COUNT(*) AS c FROM games WHERE id LIKE 'game_up_%'"
  );
  if (Number(rows[0].c) >= UPCOMING.length) return;

  const rand = makeRand(20261004);
  const now = new Date().toISOString();
  let inserted = 0;

  for (let gi = 0; gi < UPCOMING.length; gi++) {
    const g = UPCOMING[gi];

    await query(
      `INSERT INTO games
         (id, title, type, skill, date, time, end_time, location, area, region,
          total_slots, pre_filled, host_id, notes, gender, net_height,
          positions_needed, rotation_type, cost_per_person, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO NOTHING`,
      [
        g.id, g.title, g.type, g.skill, g.date, g.time, g.endTime,
        g.location, g.area, g.region, g.slots, g.host, g.notes,
        g.gender, g.net, JSON.stringify(g.positions), g.rotation,
        g.cost, now,
      ]
    );

    // --- Roster: host first, then a deterministic shuffle of everyone else ---
    const others = PLAYER_POOL.filter((u) => u !== g.host);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const target = Math.max(1, Math.round(g.slots * g.fill));
    const roster = [g.host, ...others.slice(0, target - 1)];

    for (let seq = 0; seq < roster.length; seq++) {
      // A paying game leaves a realistic mix outstanding — that mix is the
      // whole point of the host's payment list, so a free game has none.
      const paid = g.cost > 0 && (seq === 0 || rand() < 0.62);
      await query(
        `INSERT INTO game_members (game_id, user_id, status, seq, paid)
         VALUES ($1,$2,'player',$3,$4) ON CONFLICT DO NOTHING`,
        [g.id, roster[seq], seq, paid]
      );
    }

    // A full game gets two people waiting, so the waitlist path is demoable.
    if (g.fill >= 1) {
      const waiting = others.slice(target, target + 2);
      for (let w = 0; w < waiting.length; w++) {
        await query(
          `INSERT INTO game_members (game_id, user_id, status, seq, paid)
           VALUES ($1,$2,'waitlist',$3,false) ON CONFLICT DO NOTHING`,
          [g.id, waiting[w], roster.length + w]
        );
      }
    }

    // --- Chat openers, spaced a few minutes apart and attributed to people
    //     who are actually on the roster (the API rejects non-members). ---
    const lines = CHAT_OPENERS[gi] || [];
    const base = Date.now() - (UPCOMING.length - gi) * 86400000;
    for (let li = 0; li < lines.length; li++) {
      const author = roster[Math.min(li, roster.length - 1)];
      await query(
        `INSERT INTO messages (id, game_id, user_id, body, created_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [
          `msg_up_${gi}_${li}`,
          g.id,
          author,
          lines[li],
          new Date(base + li * 420000).toISOString(),
        ]
      );
    }

    inserted++;
  }

  console.log(`[seed] upcoming: ensured ${inserted} games in Sep–Oct 2026`);
}
