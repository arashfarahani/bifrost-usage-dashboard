import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { openAccess } from "@/lib/auth/tokens";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getVirtualKey } from "@/lib/bifrost/governance";
import { getReport } from "@/lib/bifrost/analytics";
import { parseRange } from "@/lib/utils/dates";
// Run against the Postman simulation explicitly; the regular suite is offline.
describe.skipIf(process.env.RUN_HTTP_INTEGRATION !== "1")(
  "real HTTP Bifrost boundary against pinned contract simulation",
  () => {
    afterAll(() => vi.unstubAllEnvs());
    it("creates 30-day, yearly, and permanent links with the real CLI", async () => {
      for (const duration of ["30d", "1y", "never"]) {
        const { stdout } = await promisify(execFile)(
          process.execPath,
          [
            "--conditions=react-server",
            "--import",
            "tsx",
            "scripts/create-link.ts",
            "--name",
            "CLI fixture",
            "--virtual-key-id",
            "vk-a",
            "--expires-in",
            duration,
          ],
          {
            env: {
              ...process.env,
              BIFROST_BASE_URL: "http://bifrost.internal.test:8080",
            },
          },
        );
        const url = new URL(stdout.trim());
        const identity = await openAccess(
          new URLSearchParams(url.hash.slice(1)).get("token")!,
        );
        expect(identity.virtualKeyId).toBe("vk-a");
        if (duration === "never") expect(identity.linkExpiresAt).toBeNull();
        else
          expect(
            identity.linkExpiresAt! - Math.floor(Date.now() / 1000),
          ).toBeGreaterThan((duration === "1y" ? 365 : 30) * 86400 - 10);
      }
    });

    it("authenticates, scopes two different keys, strips sensitive fields and maps upstream failures", async () => {
      vi.stubEnv("BIFROST_BASE_URL", "http://bifrost.internal.test:8080");
      const key = await getVirtualKey("vk-a");
      expect(key.name).toContain("vk-a");
      expect(JSON.stringify(key)).not.toContain("TEST-SECRET");
      const range = parseRange(
        new URLSearchParams("from=2026-10-01&to=2026-10-02"),
      );
      const a = await getReport("vk-a", range);
      const b = await getReport("vk-b", range);
      expect(a.totals.cost).toBe("0.125");
      expect(b.totals.cost).toBe("2.5");
      expect(a.models[0].model).toBe("fixture-model");
      expect(JSON.stringify(a)).not.toMatch(
        /TEST-PRIVATE-PROMPT|virtual_key_id/,
      );
      await expect(getVirtualKey("missing")).rejects.toMatchObject({
        code: "KEY_NOT_FOUND",
      });
      await expect(getVirtualKey("inactive")).rejects.toMatchObject({
        code: "KEY_INACTIVE",
      });
      await expect(getVirtualKey("unavailable")).rejects.toMatchObject({
        code: "BIFROST_UNAVAILABLE",
      });
      vi.stubEnv("BIFROST_ADMIN_PASSWORD", "wrong");
      await expect(getVirtualKey("vk-a")).rejects.toMatchObject({
        code: "BIFROST_AUTH",
      });
    });
  },
);
