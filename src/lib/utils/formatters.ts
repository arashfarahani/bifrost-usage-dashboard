import Decimal from "decimal.js";
export const number = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        value,
      );
export function money(value: string | number | null | undefined) {
  if (value == null) return "—";
  const d = new Decimal(value);
  if (!d.isZero() && d.abs().lt("0.00000001"))
    return `$${d.toSignificantDigits(5).toString()}`;
  return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(d.toNumber())}`;
}
export const percent = (n: number | null | undefined) =>
  n == null
    ? "—"
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n)}%`;

export const compactNumber = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US", {notation:"compact",maximumFractionDigits:2}).format(value);
