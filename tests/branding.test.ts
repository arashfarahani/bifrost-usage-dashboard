import { afterEach, expect, it, vi } from "vitest";
import { getAppName } from "@/config/branding";

afterEach(() => vi.unstubAllEnvs());

it("supports the legacy public name at runtime when APP_NAME is absent", () => {
  vi.stubEnv("APP_NAME", undefined);
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Runtime dashboard name");
  expect(getAppName()).toBe("Runtime dashboard name");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Another environment");
  expect(getAppName()).toBe("Another environment");
});

it("prefers APP_NAME and handles blank or absent names", () => {
  vi.stubEnv("APP_NAME", "  Preferred name  ");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Legacy name");
  expect(getAppName()).toBe("Preferred name");
  vi.stubEnv("APP_NAME", "  ");
  expect(getAppName()).toBe("Legacy name");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", undefined);
  expect(getAppName()).toBe("bifrost-usage-dashboard");
});
