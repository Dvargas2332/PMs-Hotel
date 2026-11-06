import { describe, expect, it } from "vitest";
import {
  CR_CHART_OF_ACCOUNTS,
  REQUIRED_SYSTEM_CODES,
  validateChart,
} from "./accounting.seed.js";

describe("plan de cuentas CR", () => {
  it("no tiene problemas de códigos, jerarquía ni cuentas requeridas", () => {
    expect(validateChart()).toEqual([]);
  });

  it("incluye las cuentas que usan las integraciones automáticas", () => {
    const codes = new Set(CR_CHART_OF_ACCOUNTS.map((a) => a.code));
    for (const code of Object.values(REQUIRED_SYSTEM_CODES)) {
      expect(codes.has(code)).toBe(true);
    }
    expect(REQUIRED_SYSTEM_CODES.cash).toBe("1.1.01.01");
    expect(REQUIRED_SYSTEM_CODES.restaurantIncome).toBe("4.1.01.01");
    expect(REQUIRED_SYSTEM_CODES.taxPayable).toBe("2.1.04.01");
    expect(REQUIRED_SYSTEM_CODES.lodgingIncome).toBe("4.1.02.01");
    expect(REQUIRED_SYSTEM_CODES.receivable).toBe("1.1.02.01");
    expect(REQUIRED_SYSTEM_CODES.customerAdvances).toBe("2.1.03.01");
  });

  it("ordena los padres antes que las hijas", () => {
    const seen = new Set<string>();
    for (const account of CR_CHART_OF_ACCOUNTS) {
      if (account.parentCode) expect(seen.has(account.parentCode)).toBe(true);
      seen.add(account.code);
    }
  });

  it("cubre las seis clases de cuentas", () => {
    const types = new Set(CR_CHART_OF_ACCOUNTS.map((a) => a.type));
    expect(types).toEqual(new Set(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "COST"]));
  });

  it("detecta un catálogo roto", () => {
    const problems = validateChart([
      { code: "1", name: "ACTIVO", type: "ASSET", isSystem: true },
      { code: "1", name: "Duplicada", type: "ASSET", parentCode: "1", isSystem: true },
      { code: "1.1.01.01.01", name: "Muy profunda", type: "ASSET", parentCode: "1", isSystem: true },
      { code: "2.1", name: "Sin padre", type: "LIABILITY", parentCode: "9.9", isSystem: false },
    ]);
    expect(problems.some((p) => p.includes("duplicado"))).toBe(true);
    expect(problems.some((p) => p.includes("más de 4 niveles"))).toBe(true);
    expect(problems.some((p) => p.includes("padre inexistente"))).toBe(true);
  });
});
