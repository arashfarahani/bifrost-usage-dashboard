import "server-only";
import Decimal from "decimal.js";
import { keyIdSchema } from "@/lib/auth/tokens";
import { bifrostGet } from "./client";
import { keySchema, budgetSchema } from "./schemas";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import type { BudgetDTO, KeyDTO } from "@/types/dashboard";
import { nextMonthlyReset } from "@/lib/utils/dates";
import { getEnv } from "@/config/env";
export function getBudgets(
  raw: z.infer<typeof keySchema>["virtual_key"],
  timezone = "Asia/Tehran",
  now = new Date(),
): BudgetDTO[] {
  const result: BudgetDTO[] = [];
  const add = (
    budgets: z.infer<typeof budgetSchema>[] | null | undefined,
    scope: string,
  ) => {
    for (const b of budgets ?? []) {
      const active =
        (b.override_amount ?? 0) > 0 &&
        (b.override_mode === "forever" ||
          (b.override_mode === "cycles" &&
            (b.override_cycles_remaining ?? 0) > 0));
      const limit = new Decimal(b.max_limit).plus(
        active ? b.override_amount! : 0,
      );
      const used = new Decimal(b.current_usage);
      result.push({
        id: `${scope}:${b.id}`,
        scope,
        limit: limit.toString(),
        used: used.toString(),
        remaining: Decimal.max(0, limit.minus(used)).toString(),
        percentage: limit.isZero() ? null : used.div(limit).mul(100).toNumber(),
        resetPeriod: b.reset_duration,
        lastReset: b.last_reset,
        nextReset: nextMonthlyReset(timezone, now),
        nextResetEstimated: true,
        override: active ? String(b.override_amount) : null,
      });
    }
  };
  for (const pc of raw.provider_configs ?? []) {
    add(pc.budgets, pc.provider);
    for (const m of pc.model_budgets ?? [])
      add(m.budgets, `${pc.provider} / ${m.model_name}`);
  }
  return result;
}
export async function getVirtualKey(id: string): Promise<KeyDTO> {
  if (!keyIdSchema.safeParse(id).success) throw new AppError("INVALID_INPUT");
  const p = keySchema.safeParse(
    await bifrostGet(`/api/governance/virtual-keys/${encodeURIComponent(id)}`),
  );
  if (!p.success || p.data.virtual_key.id !== id)
    throw new AppError("UPSTREAM_SCHEMA", 502);
  const k = p.data.virtual_key;
  if (k.is_active === false) throw new AppError("KEY_INACTIVE", 403);
  if (k.expires_at && Date.parse(k.expires_at) <= Date.now())
    throw new AppError("KEY_EXPIRED", 403);
  return {
    name: k.name,
    active: true,
    expiresAt: k.expires_at ?? null,
    budgets: getBudgets(k, getEnv().APP_TIMEZONE),
  };
}
