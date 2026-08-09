import { describe, it, expect } from "vitest";
import {
  loginLimiter,
  signupLimiter,
  authLimiter,
  apiLimiter,
  contentLimiter,
  waitlistLimiter,
  unlockLimiter,
  adminApiLimiter,
} from "../server/middleware/rateLimiters.js";

describe("rateLimiters", () => {
  it("exports all eight limiters as middleware functions", () => {
    for (const limiter of [
      loginLimiter,
      signupLimiter,
      authLimiter,
      apiLimiter,
      contentLimiter,
      waitlistLimiter,
      unlockLimiter,
      adminApiLimiter,
    ]) {
      expect(typeof limiter).toBe("function");
    }
  });
});
