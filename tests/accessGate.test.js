import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// 12+ chars, or the gate refuses to enable (MIN_PASSWORD_LENGTH).
const PASSWORD = "test-access-password-not-for-production";
const JWT_SECRET = "test-secret-not-for-production";

/** Fresh module + a tiny app mounted exactly the way server/index.js mounts it.
 *  The gate resolves its config once at module load, so each case needs a clean
 *  module registry — same `vi.resetModules()` pattern as adminAuth.test.js. */
async function buildApp(env = {}) {
  vi.resetModules();
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.APP_PRIVATE = env.APP_PRIVATE ?? "true";
  process.env.APP_ACCESS_PASSWORD = env.APP_ACCESS_PASSWORD ?? PASSWORD;

  const gate = await import("../server/middleware/accessGate.js");

  const app = express();
  if (gate.gateEnabled) {
    app.get("/unlock", (_q, r) => r.type("html").send(gate.unlockPage()));
    app.post("/unlock", express.urlencoded({ extended: false }), (q, r) => {
      if (!gate.checkPassword(q.body?.password))
        return r.status(401).type("html").send(gate.unlockPage("wrong"));
      gate.grantAccess(r);
      r.redirect(302, "/");
    });
  }
  app.use(gate.accessGate);
  app.use((q, r) => r.json({ reached: q.path }));
  return { app, gate };
}

/** Unlock and return the cookie string for subsequent requests. */
async function unlock(app) {
  const res = await request(app).post("/unlock").send(`password=${PASSWORD}`);
  return res.headers["set-cookie"][0].split(";")[0];
}

let savedEnv;
beforeEach(() => {
  savedEnv = { ...process.env };
});
afterEach(() => {
  process.env = savedEnv;
});

describe("accessGate — enabling and failing closed", () => {
  it("is enabled when APP_PRIVATE=true and the password is long enough", async () => {
    const { gate } = await buildApp();
    expect(gate.gateEnabled).toBe(true);
  });

  it("stays off when APP_PRIVATE is not set", async () => {
    const { app, gate } = await buildApp({ APP_PRIVATE: "false" });
    expect(gate.gateEnabled).toBe(false);
    for (const p of ["/", "/auth", "/api/games"]) {
      expect((await request(app).get(p)).status).toBe(200);
    }
  });

  it("stays off when APP_PRIVATE is set but the password is too short", async () => {
    // Under NODE_ENV=test this degrades to "off"; on a real deploy the module
    // aborts startup instead, which is the point — it never boots half-locked.
    const { gate } = await buildApp({ APP_ACCESS_PASSWORD: "short" });
    expect(gate.gateEnabled).toBe(false);
  });
});

describe("accessGate — what stays public", () => {
  it.each([
    "/waitlist",
    "/privacy",
    "/healthz",
    "/robots.txt",
    "/unlock",
    "/api/waitlist",
    "/api/config",
    "/assets/index-a1b2c3.js",
    "/assets/index-a1b2c3.css",
    "/sw.js",
    "/registerSW.js",
    "/manifest.webmanifest",
    "/favicon.svg",
    "/pwa-192x192.png",
  ])("%s is reachable without the cookie", async (path) => {
    const { app } = await buildApp();
    expect((await request(app).get(path)).status).toBe(200);
  });

  it("redirects / to the waitlist rather than showing a password prompt", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/waitlist");
  });
});

describe("accessGate — what is blocked", () => {
  it.each(["/auth", "/game/abc", "/create", "/settings", "/profile", "/chats"])(
    "%s returns the unlock page",
    async (path) => {
      const { app } = await buildApp();
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.text).toContain("Access password");
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["x-robots-tag"]).toContain("noindex");
    }
  );

  it.each(["/api/games", "/api/me", "/api/auth/login", "/api/notifications"])(
    "%s returns JSON, not HTML",
    async (path) => {
      const { app } = await buildApp();
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.locked).toBe(true);
    }
  );

  it("does not let a crafted file-looking path widen the allowlist", async () => {
    const { app } = await buildApp();
    // Nested paths and unknown extensions must not pass as static files.
    for (const p of ["/game/abc.js", "/a/b/c.png", "/evil.exe", "/api/games.js"]) {
      expect((await request(app).get(p)).status).toBe(401);
    }
  });
});

describe("accessGate — unlocking", () => {
  it("rejects the wrong password", async () => {
    const { app } = await buildApp();
    const res = await request(app).post("/unlock").send("password=wrong");
    expect(res.status).toBe(401);
  });

  it("accepts the right password and redirects home", async () => {
    const { app } = await buildApp();
    const res = await request(app).post("/unlock").send(`password=${PASSWORD}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("issues an httpOnly, SameSite=Lax cookie that never contains the password", async () => {
    const { app } = await buildApp();
    const res = await request(app).post("/unlock").send(`password=${PASSWORD}`);
    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toContain(PASSWORD);
  });

  it("lets an unlocked client through to everything", async () => {
    const { app } = await buildApp();
    const cookie = await unlock(app);
    for (const p of ["/", "/auth", "/game/abc", "/api/games"]) {
      const res = await request(app).get(p).set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.reached).toBe(p);
    }
  });
});

describe("accessGate — cookie forgery and expiry", () => {
  it("rejects a garbage cookie", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/api/games").set("Cookie", "coterie_access=deadbeef");
    expect(res.status).toBe(401);
  });

  it("rejects a cookie whose expiry has been pushed out by hand", async () => {
    const { app } = await buildApp();
    const cookie = await unlock(app);
    const mac = cookie.split(".")[1];
    const forged = `coterie_access=${Date.now() + 10 ** 10}.${mac}`;
    expect((await request(app).get("/api/games").set("Cookie", forged)).status).toBe(401);
  });

  it("rejects an already-expired cookie even with a valid signature", async () => {
    const { gate, app } = await buildApp();
    // Re-sign with a past expiry the same way the module does, proving the
    // check is the timestamp itself and not just the HMAC.
    const past = Date.now() - 1000;
    const crypto = await import("node:crypto");
    const mac = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${PASSWORD}.${past}`)
      .digest("hex");
    expect(gate.gateEnabled).toBe(true);
    const res = await request(app).get("/api/games").set("Cookie", `coterie_access=${past}.${mac}`);
    expect(res.status).toBe(401);
  });

  it("stops honouring cookies once the password changes", async () => {
    const { app: oldApp } = await buildApp();
    const cookie = await unlock(oldApp);
    const { app: newApp } = await buildApp({
      APP_ACCESS_PASSWORD: "a-completely-different-password",
    });
    expect((await request(newApp).get("/api/games").set("Cookie", cookie)).status).toBe(401);
  });
});
