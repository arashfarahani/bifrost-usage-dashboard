import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { EncryptJWT, base64url } from "jose";
import {
  sealAccess,
  openAccess,
  sealSession,
  openSession,
} from "@/lib/auth/tokens";
const who = { displayName: "آرش", virtualKeyId: "vk-arash" };
beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-31T12:00:00Z") }));
afterEach(() => vi.useRealTimers());
describe("personal access credentials", () => {
  it("encrypts identity and round-trips it without plaintext", async () => {
    const token = await sealAccess(who, 86400);
    expect(token.split(".")).toHaveLength(5);
    expect(token).not.toContain("vk-arash");
    expect(await openAccess(token)).toMatchObject(who);
  });
  it.each(["garbage", "", "a.b.c.d.e"])(
    "rejects malformed token %s",
    async (token) => {
      await expect(openAccess(token)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
      });
    },
  );
  it("rejects tampering", async () => {
    const t = await sealAccess(who, 60);
    const p = t.split(".");
    p[3] = (p[3][0] === "a" ? "b" : "a") + p[3].slice(1);
    await expect(openAccess(p.join("."))).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });
  it("rejects expired links", async () => {
    const t = await sealAccess(who, 60);
    vi.advanceTimersByTime(60000);
    await expect(openAccess(t)).rejects.toMatchObject({
      code: "EXPIRED_TOKEN",
    });
  });
  it.each([
    { aud: "another-app" },
    { iss: "someone-else" },
    { virtualKeyId: "vk-a,vk-b" },
    { virtualKeyId: "sk-bf-secret" },
    { version: 2 },
  ])("rejects authenticated but invalid claims %j", async (override) => {
    const t = await new EncryptJWT({ version: 1, ...who, ...override })
      .setProtectedHeader({
        alg: "dir",
        enc: "A256GCM",
        typ: "llm-usage-access+jwt",
      })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer("iss" in override ? override.iss! : "llm-usage")
      .setAudience("aud" in override ? override.aud! : "usage-dashboard")
      .encrypt(base64url.decode(process.env.ACCESS_TOKEN_ENCRYPTION_KEY!));
    await expect(openAccess(t)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });
  it("keeps session shorter than a long link and separates credentials", async () => {
    const a = await sealAccess(who, 86400);
    const identity = await openAccess(a);
    const session = await sealSession(identity);
    expect((await openSession(session)).expiresAt).toBe(1793451600);
    await expect(openAccess(session)).rejects.toBeDefined();
    await expect(openSession(a)).rejects.toBeDefined();
    vi.advanceTimersByTime(3600000);
    await expect(openSession(session)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });
  it("caps session at the original link expiry", async () => {
    const a = await sealAccess(who, 30);
    const identity = await openAccess(a);
    const s = await sealSession(identity);
    expect((await openSession(s)).expiresAt).toBe(identity.linkExpiresAt);
    vi.advanceTimersByTime(30000);
    await expect(openSession(s)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });
  it("rejects unscopable IDs before minting", async () => {
    await expect(
      sealAccess({ ...who, virtualKeyId: "../keys" }, 3600),
    ).rejects.toBeDefined();
  });
});

it("supports explicit permanent links but always expires their sessions", async () => {
  const access = await sealAccess(who, null);
  const identity = await openAccess(access);
  expect(identity.linkExpiresAt).toBeNull();
  expect(identity.expiresAt).toBeNull();
  const session = await sealSession(identity);
  expect((await openSession(session)).expiresAt).toBe(
    Math.floor(Date.now() / 1000) + 3600,
  );
  vi.advanceTimersByTime(366 * 86400000);
  expect((await openAccess(access)).virtualKeyId).toBe(who.virtualKeyId);
  await expect(openSession(session)).rejects.toMatchObject({
    code: "INVALID_SESSION",
  });
});
it("supports a full year while rejecting implicit permanent credentials", async () => {
  const access = await sealAccess(who, 365 * 86400);
  expect((await openAccess(access)).expiresAt).toBe(
    Math.floor(Date.now() / 1000) + 365 * 86400,
  );
  const malformed = await new EncryptJWT({ version: 1, ...who })
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
      typ: "llm-usage-access+jwt",
    })
    .setIssuedAt()
    .setIssuer("llm-usage")
    .setAudience("usage-dashboard")
    .encrypt(base64url.decode(process.env.ACCESS_TOKEN_ENCRYPTION_KEY!));
  await expect(openAccess(malformed)).rejects.toMatchObject({
    code: "INVALID_TOKEN",
  });
});
