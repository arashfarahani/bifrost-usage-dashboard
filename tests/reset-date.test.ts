import { describe, expect, it } from "vitest";
import { getBudgets } from "@/lib/bifrost/governance";
import { keySchema } from "@/lib/bifrost/schemas";
const key = keySchema.parse({
  virtual_key: {
    id: "vk-a",
    name: "A",
    provider_configs: [
      {
        provider: "openai",
        budgets: [
          {
            id: "budget",
            max_limit: 30,
            current_usage: 5,
            reset_duration: "1M",
            last_reset: "2026-10-01T00:00:00Z",
          },
        ],
      },
    ],
  },
}).virtual_key;
describe("monthly reset fallback", () => {
  it.each([
    ["2026-10-31T12:00:00Z", "Asia/Tehran", "2026-10-31T20:30:00.000Z"],
    ["2026-12-31T12:00:00Z", "UTC", "2027-01-01T00:00:00.000Z"],
    ["2026-11-01T00:00:00Z", "Asia/Tehran", "2026-11-30T20:30:00.000Z"],
  ])(
    "estimates the next local calendar month for %s in %s",
    (now, timezone, expected) => {
      const budget = getBudgets(key, timezone, new Date(now))[0];
      expect(budget.nextReset).toBe(expected);
      expect(budget.nextResetEstimated).toBe(true);
      expect(budget.scope).toBe("openai");
    },
  );
});

it("ignores key-wide and shared budgets in favor of provider rules", () => {
  const raw = {
    ...key,
    budgets: [{ ...key.provider_configs![0].budgets![0], id: "ignored" }],
    team: { name: "Shared", budgets: key.provider_configs![0].budgets },
  };
  const result = getBudgets(raw);
  expect(result).toHaveLength(1);
  expect(result[0].scope).toBe("openai");
});
