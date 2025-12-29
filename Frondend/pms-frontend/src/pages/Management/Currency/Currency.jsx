// src/pages/Management/Currency/Currency.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import useConfigStore from "../../../store/configStore";
import { api } from "../../../lib/api";

export default function Currency() {
  const { config, setFx } = useConfigStore();

  const [state, setState] = useState(() => {
    const fx = config.accounting.fx || {};
    return {
      ...fx,
      rounding: typeof fx.rounding === "number" ? fx.rounding : 2,
      enabled: typeof fx.enabled === "boolean" ? fx.enabled : true,
    };
  });

  const [saving, setSaving] = useState(false);
  const [secondary, setSecondary] = useState(
    () => config.accounting.fx?.secondary || "USD"
  );

  const load = async () => {
    try {
      const { data } = await api.get("/hotel/currency");
      if (data) {
        const next = {
          ...state,
          base: data.base || config.accounting.currency || "CRC",
          buy: Number(data.buy || 0),
          sell: Number(data.sell || 0),
          secondary: secondary || state.secondary || "USD",
          rates: {
            ...(state.rates || {}),
            [secondary || "USD"]: Number(data.sell || data.buy || 0),
          },
        };
        setState(next);
        setFx(next);
      }
    } catch (err) {
      console.error("No se pudo cargar currency", err);
    }
  };

  useEffect(() => {
    const fx = config.accounting.fx || {};
    setState((prev) => ({
      ...prev,
      ...fx,
      rounding: typeof fx.rounding === "number" ? fx.rounding : prev.rounding ?? 2,
      enabled:
        typeof fx.enabled === "boolean" ? fx.enabled : prev.enabled ?? true,
    }));
    setSecondary(config.accounting.fx?.secondary || "USD");
  }, [config.accounting.fx]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      base: state.base || config.accounting.currency || "CRC",
      buy: Number(state.buy || 0),
      sell: Number(state.sell || 0),
    };
    try {
      const { data } = await api.put("/hotel/currency", payload);
      const next = {
        ...state,
        base: data?.base || payload.base,
        buy: Number(data?.buy ?? payload.buy),
        sell: Number(data?.sell ?? payload.sell),
        secondary: secondary || "USD",
        rates: {
          ...(state.rates || {}),
          [secondary || "USD"]: Number(data?.sell ?? payload.sell),
        },
      };
      setState(next);
      setFx(next);
    } finally {
      setSaving(false);
    }
  };

  const decimals = (() => {
    const n = Number(state.rounding);
    if (!Number.isFinite(n) || n < 0) return 0;
    if (n > 6) return 6;
    return Math.floor(n);
  })();

  const formatAmount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return n.toFixed(decimals);
  };

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-medium">Currency and exchange rates (per hotel)</h3>
      <p className="text-xs text-slate-500">
        <strong>Base currency</strong> is used for room prices, reservations and hotel billing.
        The <strong>secondary currency</strong> is used for buy/sell exchange (automatic amount conversion).
      </p>

      {/* Moneda principal / secundaria / redondeo, uno debajo del otro */}
      <div className="space-y-3">
        <div className="space-y-1 max-w-[240px]">
          <label className="text-xs text-slate-500">Base currency (local)</label>
          <Select
            value={state.base || "CRC"}
            onChange={(val) => setState((s) => ({ ...s, base: val }))}
            options={[
              { value: "CRC", label: "CRC - Costa Rican colon" },
              { value: "USD", label: "USD - US dollar" },
              { value: "EUR", label: "EUR – Euro" },
              { value: "GBP", label: "GBP - Pound sterling" },
              { value: "MXN", label: "MXN - Mexican peso" },
              { value: "COP", label: "COP - Colombian peso" },
              { value: "BRL", label: "BRL - Brazilian real" },
              { value: "ARS", label: "ARS - Argentine peso" },
              { value: "CLP", label: "CLP - Chilean peso" },
              { value: "PEN", label: "PEN - Peruvian sol" },
              { value: "CAD", label: "CAD - Canadian dollar" },
              { value: "JPY", label: "JPY - Japanese yen" },
            ]}
          />
        </div>

        <div className="space-y-1 max-w-[240px]">
          <label className="text-xs text-slate-500">Secondary currency (exchange)</label>
          <Select
            value={secondary || "USD"}
            onChange={(val) => setSecondary(val)}
            options={[
              { value: "USD", label: "USD - US dollar" },
              { value: "EUR", label: "EUR – Euro" },
              { value: "GBP", label: "GBP - Pound sterling" },
              { value: "CRC", label: "CRC - Costa Rican colon" },
              { value: "MXN", label: "MXN - Mexican peso" },
              { value: "COP", label: "COP - Colombian peso" },
              { value: "BRL", label: "BRL - Brazilian real" },
              { value: "ARS", label: "ARS - Argentine peso" },
              { value: "CLP", label: "CLP - Chilean peso" },
              { value: "PEN", label: "PEN - Peruvian sol" },
              { value: "CAD", label: "CAD - Canadian dollar" },
              { value: "JPY", label: "JPY - Japanese yen" },
            ]}
          />
        </div>

        <div className="space-y-1 max-w-[180px]">
          <label className="text-xs text-slate-500">
            Rounding (number of decimals)
          </label>
          <Input
            className="h-9 text-sm"
            type="number"
            min={0}
            max={6}
            placeholder="e.g. 0, 2, 4"
            value={state.rounding ?? ""}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                rounding: e.target.value.replace(/[^0-9]/g, ""),
              }))
            }
          />
        </div>
      </div>

      {/* Compra / venta de la moneda secundaria */}
      <div className="grid md:grid-cols-4 gap-2">
        <Input
          className="h-9 text-sm"
          placeholder={`FX ${secondary || "USD"} (referencia)`}
          type="number"
          value={state.rates?.[secondary] ?? 0}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              rates: {
                ...s.rates,
                [secondary]: Number(e.target.value || 0),
              },
            }))
          }
        />
        <Input
          className="h-9 text-sm"
          placeholder={`Buy ${secondary || "USD"}`}
          type="number"
          value={state.buy ?? 0}
          onChange={(e) =>
            setState((s) => ({ ...s, buy: Number(e.target.value || 0) }))
          }
        />
        <Input
          className="h-9 text-sm"
          placeholder={`Sell ${secondary || "USD"}`}
          type="number"
          value={state.sell ?? 0}
          onChange={(e) =>
            setState((s) => ({ ...s, sell: Number(e.target.value || 0) }))
          }
        />
      </div>

      {/* Resumen / activación */}
      <div className="mt-3 border rounded-lg px-3 py-2 bg-slate-50 space-y-2 text-xs text-slate-700">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={state.enabled ?? true}
            onChange={(e) =>
              setState((s) => ({ ...s, enabled: e.target.checked }))
            }
          />
          <span>Enable automatic conversion with this configuration</span>
        </label>
        <div>
          Base currency: <strong>{state.base || "CRC"}</strong>
        </div>
        <div>
          Secondary currency: <strong>{secondary || "USD"}</strong> - Buy:{" "}
          <strong>{formatAmount(state.buy)}</strong> · Sell:{" "}
          <strong>{formatAmount(state.sell)}</strong> · Decimals:{" "}
          <strong>{decimals}</strong>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={load} disabled={saving}>
          Reload
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}
