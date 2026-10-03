import { describe, expect, it } from "vitest";
import { createDb, migrateDb } from "./client";
import { clientIp, rateLimit } from "./rateLimit";

describe("rateLimit", () => {
  it("allows up to the limit within a window, then blocks until it resets", () => {
    const db = createDb(":memory:");
    migrateDb(db);
    const t = 1_000_000_040; // 20 s into a 60 s window (1_000_000_020 is a window start)
    for (let i = 0; i < 3; i++) expect(rateLimit(db, "ip:1", 3, 60, t).allowed).toBe(true);
    const blocked = rateLimit(db, "ip:1", 3, 60, t + 5);
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfter: 35 });
    expect(rateLimit(db, "ip:2", 3, 60, t).allowed).toBe(true); // other keys unaffected
    expect(rateLimit(db, "ip:1", 3, 60, t + 41).allowed).toBe(true); // next window
  });

  it("reports the remaining requests", () => {
    const db = createDb(":memory:");
    migrateDb(db);
    expect(rateLimit(db, "k", 5, 60, 120).remaining).toBe(4);
    expect(rateLimit(db, "k", 5, 60, 121).remaining).toBe(3);
  });
});

describe("clientIp", () => {
  const h = (values: Record<string, string>) => ({ get: (n: string) => values[n] ?? null });
  it("prefers X-Real-IP, then the first X-Forwarded-For address", () => {
    expect(clientIp(h({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
