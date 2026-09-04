/**
 * Programs — coached courses and club memberships.
 *
 * ⚠️ **This is prototype data, not a real listing.** Every coach, club, price
 * and phone-less contact below is invented, and nothing here is wired to a
 * backend: there is no `programs` table, no booking, no money. It exists so the
 * Programs tab can be demoed end to end before any of that is built.
 *
 * The venues and regions ARE real, and match `src/lib/courts.ts`, so the tab
 * reads like the rest of the app rather than like placeholder text.
 *
 * When this becomes real: move `PROGRAMS` behind an API, keep the shape, and
 * delete this file. Until then, `Programs.tsx` labels the tab as a preview —
 * do not remove that label while the data is fake.
 */

import type { Region } from "./courts";

export type ProgramKind = "Lesson" | "Club";

export interface Program {
  id: string;
  kind: ProgramKind;
  title: string;
  /** Coach for a lesson, organiser for a club. */
  lead: string;
  leadCredential: string;
  venue: string;
  area: string;
  region: Region;
  /** Human-readable recurrence, e.g. "Tuesdays, 7.30–9.30pm". */
  schedule: string;
  /** Who it's for, in the app's own grading language. */
  level: string;
  /** Price in dollars. `per` says what that price buys. */
  price: number;
  per: "session" | "course" | "month";
  /** Only meaningful for a course — how many sessions it runs for. */
  sessions?: number;
  /** One line for the card. */
  summary: string;
  /** Longer copy for the detail page. */
  about: string;
  includes: string[];
  /** Upcoming dates, ISO. First is the next one. */
  dates: string[];
}

export const PROGRAMS: Program[] = [
  {
    id: "prog_1",
    kind: "Lesson",
    title: "Absolute Beginners: Six-Week Foundations",
    lead: "Coach Marcus Tan",
    leadCredential: "NROC Level 2 · ex-national youth squad",
    venue: "Toa Payoh Sport Hall",
    area: "Toa Payoh",
    region: "Central",
    schedule: "Tuesdays, 7.30–9.30pm",
    level: "Never played before",
    price: 180,
    per: "course",
    sessions: 6,
    summary: "Start from zero — passing, setting, serving, then real games.",
    about:
      "Six weeks that take you from never having touched a ball to holding your own in a pickup game. Weeks one to three are the three contacts — pass, set, hit — broken down slowly with lots of repetition. Weeks four to six put them together in small-sided games so you learn where to stand and when to move. You don't need to be fit, tall, or sporty, and nobody in the group will have played before either.",
    includes: [
      "6 × 2-hour coached sessions",
      "All equipment provided",
      "Max 16 players, 2 coaches",
      "A free drop-in pass for any Coterie beginner game",
    ],
    dates: ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"],
  },
  {
    id: "prog_2",
    kind: "Lesson",
    title: "Serve & Receive Clinic",
    lead: "Coach Priya Raman",
    leadCredential: "NROC Level 2 · 8 years coaching school teams",
    venue: "Our Tampines Hub Sport Hall",
    area: "Tampines",
    region: "East",
    schedule: "Saturdays, 9–11am",
    level: "High Beginner and up",
    price: 45,
    per: "session",
    summary: "The two skills that decide most pickup rallies, drilled hard for two hours.",
    about:
      "A single-session clinic on the two things that decide most social games: a serve that lands in, and a first contact that gives your setter something to work with. Expect a lot of repetition and video on your own platform and float serve. Come if you can already keep a rally going but your serve goes long or your passes shoot sideways.",
    includes: [
      "2-hour focused clinic",
      "Video feedback on your serve",
      "Max 14 players",
      "Balls and target nets provided",
    ],
    dates: ["2026-10-11", "2026-10-25", "2026-11-08"],
  },
  {
    id: "prog_3",
    kind: "Lesson",
    title: "Setter School",
    lead: "Coach Wei Jie Lim",
    leadCredential: "Former NUS captain · setter for 12 years",
    venue: "OCBC Arena (The Kallang)",
    area: "Kallang",
    region: "Central",
    schedule: "Thursdays, 8–10pm",
    level: "Low Intermediate and up",
    price: 240,
    per: "course",
    sessions: 4,
    summary: "Hands, footwork and decision-making for anyone who keeps getting handed the setter role.",
    about:
      "Most pickup setters got the job because nobody else wanted it. Four weeks to actually learn it: clean hands that don't get called, footwork to the target, and the decisions — when to push the middle, when to go back-set, when to just give your hitter a high ball and let them work. Small group so everyone sets several hundred balls a night.",
    includes: [
      "4 × 2-hour sessions",
      "Max 10 players",
      "Slow-motion hand review",
      "A written cheat-sheet on run plays",
    ],
    dates: ["2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"],
  },
  {
    id: "prog_4",
    kind: "Lesson",
    title: "Beach Fundamentals",
    lead: "Coach Aisyah Rahman",
    leadCredential: "AVC beach certification · SEA Games squad 2023",
    venue: "Sports Hub Beach Volleyball Courts",
    area: "Kallang",
    region: "Central",
    schedule: "Sundays, 4–6pm",
    level: "Any level, indoor experience helpful",
    price: 55,
    per: "session",
    summary: "Sand is a different sport — movement, wind, and two-player defence.",
    about:
      "Everything you know from indoor works differently on sand: you can't jump the same, you can't run the same, and with two players there's nowhere to hide. This session covers shuffling instead of running, reading the wind on a serve, the shots that actually score in a 2s game, and how to block-and-cover with one partner. Bring sunscreen and water.",
    includes: [
      "2 hours on court",
      "Max 12 players across 3 courts",
      "Beach balls and lines provided",
      "Water and towels",
    ],
    dates: ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"],
  },
  {
    id: "prog_5",
    kind: "Club",
    title: "Kallang Volleyball Club",
    lead: "Organised by Arjun Nair",
    leadCredential: "Running since 2019 · ~90 members",
    venue: "OCBC Arena (The Kallang)",
    area: "Kallang",
    region: "Central",
    schedule: "Mondays & Wednesdays, 8–10pm",
    level: "High Intermediate and up",
    price: 90,
    per: "month",
    summary: "Twice-weekly competitive sessions with a fixed squad and a league team.",
    about:
      "The most competitive club on the list. Two structured sessions a week with proper warm-ups, a 5-1 system and real scoring, plus an A team that plays in the national club league. Members are expected at one of the two sessions most weeks — this isn't drop-in. There's a trial night before you commit, and the organisers will tell you honestly if it's too fast for you right now.",
    includes: [
      "8–9 sessions a month",
      "Club jersey after 3 months",
      "Optional league team",
      "Free trial session before you sign up",
    ],
    dates: ["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14"],
  },
  {
    id: "prog_6",
    kind: "Club",
    title: "West Side Social Volleyball",
    lead: "Organised by Nur Aisyah B.",
    leadCredential: "Running since 2022 · ~140 members",
    venue: "Jurong East Sport Hall",
    area: "Jurong East",
    region: "West",
    schedule: "Wednesdays & Sundays",
    level: "All levels",
    price: 45,
    per: "month",
    summary: "The biggest social club in the west. Turn up as often or as little as you like.",
    about:
      "Deliberately unserious. Two sessions a week, no attendance expectations, and the courts are split by level so a first-timer and a former school player both get a decent game. About half the members joined knowing nobody. There's a group chat that mostly talks about where to eat afterwards.",
    includes: [
      "Unlimited sessions on your month",
      "Courts split by level",
      "Members' group chat",
      "Guest passes for friends",
    ],
    dates: ["2026-10-07", "2026-10-11", "2026-10-14", "2026-10-18"],
  },
  {
    id: "prog_7",
    kind: "Club",
    title: "Sunrise Beach Club",
    lead: "Organised by Hui Wen Ong",
    leadCredential: "Running since 2021 · ~55 members",
    venue: "East Coast Park Beach Volleyball Courts",
    area: "East Coast",
    region: "East",
    schedule: "Saturdays & Sundays, 7.30–10am",
    level: "All levels",
    price: 35,
    per: "month",
    summary: "Weekend mornings on the sand, finished before the heat arrives.",
    about:
      "Early starts by design — you're off the sand by ten and the rest of the weekend is yours. Nets go up at 7.30, we rotate 2s and 4s depending on who turns up, and there's breakfast at the hawker centre afterwards for anyone who wants it. Levels are genuinely mixed and the regulars are good about pairing a beginner with someone experienced.",
    includes: [
      "8 weekend sessions a month",
      "Nets and balls provided",
      "Beginner pairing on request",
      "Post-session breakfast (pay your own)",
    ],
    dates: ["2026-10-04", "2026-10-05", "2026-10-11", "2026-10-12"],
  },
  {
    id: "prog_8",
    kind: "Club",
    title: "North Ladies' Volleyball",
    lead: "Organised by Jia Min T.",
    leadCredential: "Running since 2024 · ~70 members",
    venue: "Sengkang Sport Hall",
    area: "Sengkang",
    region: "North",
    schedule: "Tuesdays, 7.30–9.30pm",
    level: "All levels, women only",
    price: 40,
    per: "month",
    summary: "A women's club in the north, built around people who started as adults.",
    about:
      "Started because the north had nothing for women who picked the sport up after school. Most members began in their twenties or thirties and several started at the club itself. One session a week, coached warm-up for the first half hour, then games. Bring a friend or come alone — someone will look out for you either way.",
    includes: [
      "4 sessions a month",
      "Coached warm-up each week",
      "Women only",
      "First session free",
    ],
    dates: ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"],
  },
];

export function getProgram(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}

/** "$180 for 6 sessions" / "$45 a session" / "$90 a month" */
export function priceLabel(p: Program): string {
  const amount = `$${p.price}`;
  if (p.per === "course") return `${amount} for ${p.sessions} sessions`;
  if (p.per === "month") return `${amount} a month`;
  return `${amount} a session`;
}
