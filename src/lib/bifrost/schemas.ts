import { z } from "zod";
export const number = z.number().finite().nonnegative();
export const count = number.int().max(Number.MAX_SAFE_INTEGER);
export const budgetSchema = z.object({
  id: z.string().min(1),
  max_limit: number,
  current_usage: number,
  reset_duration: z.string().min(1),
  last_reset: z.iso.datetime({ offset: true }),
  override_amount: number.optional(),
  override_mode: z.enum(["", "forever", "cycles"]).optional(),
  override_cycles_remaining: z.number().int().optional(),
});
const rules = z.array(budgetSchema).nullish();
const model = z.object({ model_name: z.string(), budgets: rules });
export const keySchema = z.object({
  virtual_key: z.object({
    id: z.string(),
    name: z.string().max(256),
    is_active: z.boolean().nullish(),
    expires_at: z.iso.datetime({ offset: true }).nullish(),
    budgets: rules,
    provider_configs: z
      .array(
        z.object({
          provider: z.string(),
          budgets: rules,
          model_budgets: z.array(model).nullish(),
        }),
      )
      .nullish(),
    team: z.object({ name: z.string(), budgets: rules }).nullish(),
    customer: z.object({ name: z.string(), budgets: rules }).nullish(),
  }),
});
export const statsSchema = z.object({
  success_rate: number.max(100).optional(),
  user_facing_success_rate: number.max(100).optional(),
  average_latency: number.optional(),
  total_requests: count,
  total_cost: number,
  prompt_tokens: count,
  completion_tokens: count,
  total_tokens: count,
});
const tokens = z.object({
  // These upstream Go integer fields use omitempty; an omitted scalar is zero.
  prompt_tokens: count.default(0),
  completion_tokens: count.default(0),
  total_tokens: count,
  prompt_tokens_details: z
    .object({
      cached_read_tokens: count.optional(),
      cached_tokens: count.optional(),
    })
    .nullish(),
});
export const rowSchema = z.object({
  id: z.string().min(1),
  virtual_key_id: z.string(),
  timestamp: z.iso.datetime({ offset: true }),
  provider: z.string().max(256),
  model: z.string().max(256),
  status: z.string(),
  latency: number.nullish(),
  cost: number.nullish(),
  token_usage: tokens.nullish(),
});
export const logsSchema = z.object({
  logs: z.array(rowSchema),
  pagination: z.object({ total_count: count, offset: count, limit: count }),
  has_logs: z.boolean(),
});
export type SafeLog = z.infer<typeof rowSchema>;
