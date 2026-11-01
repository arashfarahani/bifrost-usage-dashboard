import { afterEach, describe, expect, it, vi } from "vitest";
import { sealAccess } from "@/lib/auth/tokens";
import { POST as redeem } from "@/app/api/auth/redeem/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as dashboard } from "@/app/api/dashboard/[section]/route";
function post(body: unknown, origin = "https://usage.example.test") {
  return new Request("https://usage.example.test/api/auth/redeem", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("stateless route boundaries", () => {
  it("rejects cross-origin redeem and logout", async () => {
    expect(
      (await redeem(post({ token: "a" }, "https://evil.test"))).status,
    ).toBe(403);
    expect((await logout(post({}, "null"))).status).toBe(403);
  });
  it("clears the session cookie on same-origin logout", async () => {
    const r = await logout(post({}));
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(r.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects missing session and client-supplied identity", async () => {
    expect(
      (
        await dashboard(
          new Request("https://usage.example.test/api/dashboard/budget"),
          { params: Promise.resolve({ section: "budget" }) },
        )
      ).status,
    ).toBe(401);
  });
  it("redeems a valid link, emits a minimal encrypted cookie and denies scope override", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        virtual_key: {
          id: "vk-a",
          name: "Real Name",
          is_active: true,
          value: "UPSTREAM-SECRET",
          provider_configs: [],
        },
      }),
    );
    const token = await sealAccess(
      { displayName: "آرش", virtualKeyId: "vk-a" },
      60,
    );
    const res = await redeem(post({ token }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).not.toContain("vk-a");
    expect(cookie).not.toContain(token);
    const h = { cookie: cookie.split(";")[0] };
    const r = await dashboard(
      new Request("https://usage.example.test/api/dashboard/budget", {
        headers: h,
      }),
      { params: Promise.resolve({ section: "budget" }) },
    );
    expect(r.status).toBe(200);
    expect(JSON.stringify(await r.json())).not.toMatch(
      /UPSTREAM-SECRET|vk-a|virtualKeyId/,
    );
    const bad = await dashboard(
      new Request(
        "https://usage.example.test/api/dashboard/budget?virtualKeyId=vk-b",
        { headers: h },
      ),
      { params: Promise.resolve({ section: "budget" }) },
    );
    expect(bad.status).toBe(400);
  });
  it("rejects excessively large redemption bodies without reflecting payloads", async () => {
    const r = await redeem(post({ token: "secret".repeat(2000) }));
    expect(r.status).toBe(400);
    expect(await r.text()).not.toContain("secret");
  });
});
