export function parseMoneyInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

export function normalizeMoneyInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const num = parseMoneyInput(raw);
  if (!Number.isFinite(num)) return raw;
  return num.toFixed(2);
}
