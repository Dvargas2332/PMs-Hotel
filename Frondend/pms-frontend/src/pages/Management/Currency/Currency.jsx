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
      <h3 className="font-medium">Moneda y tipo de cambio (por hotel)</h3>
      <p className="text-xs text-slate-500">
        <strong>Moneda principal</strong> se usa para los precios de habitaciones, reservas y
        facturación del hotel. La <strong>moneda secundaria</strong> es la que funcionará como
        moneda de cambio para compra y venta (conversión automática de montos).
      </p>

      {/* Moneda principal / secundaria / redondeo, uno debajo del otro */}
      <div className="space-y-3">
        <div className="space-y-1 max-w-[240px]">
          <label className="text-xs text-slate-500">Moneda principal (local)</label>
          <Select
            value={state.base || "CRC"}
            onChange={(val) => setState((s) => ({ ...s, base: val }))}
            options={[
              { value: "CRC", label: "CRC – Colón costarricense" },
              { value: "USD", label: "USD – Dólar estadounidense" },
              { value: "EUR", label: "EUR – Euro" },
              { value: "GBP", label: "GBP – Libra esterlina" },
              { value: "MXN", label: "MXN – Peso mexicano" },
              { value: "COP", label: "COP – Peso colombiano" },
              { value: "BRL", label: "BRL – Real brasileño" },
              { value: "ARS", label: "ARS – Peso argentino" },
              { value: "CLP", label: "CLP – Peso chileno" },
              { value: "PEN", label: "PEN – Sol peruano" },
              { value: "CAD", label: "CAD – Dólar canadiense" },
              { value: "JPY", label: "JPY – Yen japonés" },
            ]}
          />
        </div>

        <div className="space-y-1 max-w-[240px]">
          <label className="text-xs text-slate-500">Moneda secundaria (de cambio)</label>
          <Select
            value={secondary || "USD"}
            onChange={(val) => setSecondary(val)}
            options={[
              { value: "USD", label: "USD – Dólar estadounidense" },
              { value: "EUR", label: "EUR – Euro" },
              { value: "GBP", label: "GBP – Libra esterlina" },
              { value: "CRC", label: "CRC – Colón costarricense" },
              { value: "MXN", label: "MXN – Peso mexicano" },
              { value: "COP", label: "COP – Peso colombiano" },
              { value: "BRL", label: "BRL – Real brasileño" },
              { value: "ARS", label: "ARS – Peso argentino" },
              { value: "CLP", label: "CLP – Peso chileno" },
              { value: "PEN", label: "PEN – Sol peruano" },
              { value: "CAD", label: "CAD – Dólar canadiense" },
              { value: "JPY", label: "JPY – Yen japonés" },
            ]}
          />
        </div>

        <div className="space-y-1 max-w-[180px]">
          <label className="text-xs text-slate-500">
            Redondeo (cantidad de decimales a usar)
          </label>
          <Input
            className="h-9 text-sm"
            type="number"
            min={0}
            max={6}
            placeholder="Ej: 0, 2, 4"
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
          placeholder={`Compra ${secondary || "USD"}`}
          type="number"
          value={state.buy ?? 0}
          onChange={(e) =>
            setState((s) => ({ ...s, buy: Number(e.target.value || 0) }))
          }
        />
        <Input
          className="h-9 text-sm"
          placeholder={`Venta ${secondary || "USD"}`}
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
          <span>Activar conversión automática con esta configuración</span>
        </label>
        <div>
          Moneda principal: <strong>{state.base || "CRC"}</strong>
        </div>
        <div>
          Moneda secundaria: <strong>{secondary || "USD"}</strong> — Compra:{" "}
          <strong>{formatAmount(state.buy)}</strong> · Venta:{" "}
          <strong>{formatAmount(state.sell)}</strong> · Decimales:{" "}
          <strong>{decimals}</strong>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={load} disabled={saving}>
          Recargar
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </Card>
  );
}

