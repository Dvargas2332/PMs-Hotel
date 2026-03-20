const WEIGHT = new Map([
  ["g", 1],
  ["kg", 1000],
  ["oz", 28.349523125],
  ["lb", 453.59237],
]);

const VOLUME = new Map([
  ["ml", 1],
  ["l", 1000],
]);

export function normalizeUnit(u?: string | null) {
  return String(u || "").trim().toLowerCase();
}

export function unitCategory(u?: string | null) {
  const unit = normalizeUnit(u);
  if (unit === "un") return "count";
  if (WEIGHT.has(unit)) return "weight";
  if (VOLUME.has(unit)) return "volume";
  return "unknown";
}

export function isSupportedUnit(u?: string | null) {
  return unitCategory(u) !== "unknown";
}

export function canConvert(from: string, to: string) {
  const a = unitCategory(from);
  const b = unitCategory(to);
  return a !== "unknown" && a === b;
}

export function convertQty(value: number, fromUnit: string, toUnit: string) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  const cat = unitCategory(from);
  if (cat !== unitCategory(to)) {
    throw new Error(`Unidades incompatibles: ${fromUnit} -> ${toUnit}`);
  }
  if (cat === "count") return value;
  if (cat === "weight") {
    const fromFactor = WEIGHT.get(from)!;
    const toFactor = WEIGHT.get(to)!;
    const grams = value * fromFactor;
    return grams / toFactor;
  }
  if (cat === "volume") {
    const fromFactor = VOLUME.get(from)!;
    const toFactor = VOLUME.get(to)!;
    const ml = value * fromFactor;
    return ml / toFactor;
  }
  throw new Error(`Unidad desconocida: ${fromUnit}`);
}
