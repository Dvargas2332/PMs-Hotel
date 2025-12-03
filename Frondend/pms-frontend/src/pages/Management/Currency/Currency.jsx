//src/pages/Management/Currency/Currency.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import useConfigStore from "../../../store/configStore";
import { api } from "../../../lib/api";

export default function Currency() {
  const { config, setFx } = useConfigStore();
  const [state, setState] = useState(() => config.accounting.fx || {});
  const [saving, setSaving] = useState(false);
  const [secondary, setSecondary] = useState(() => config.accounting.fx?.secondary || "USD");

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
          rates: { ...(state.rates || {}), [secondary || "USD"]: Number(data.sell || data.buy || 0) },
        };
        setState(next);
        setFx(next);
      }
    } catch (err) {
      console.error("No se pudo cargar currency", err);
    }
  };

  useEffect(() => {
    setState(config.accounting.fx || {});
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
        rates: { ...(state.rates || {}), [secondary || "USD"]: Number(data?.sell ?? payload.sell) },
      };
      setState(next);
      setFx(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-medium">Moneda y Tipo de Cambio (por hotel)</h3>
      <div className="grid md:grid-cols-3 gap-2">
        <Input
          className="h-9 text-sm"
          placeholder="Moneda local"
          value={state.base || ""}
          onChange={(e) => setState((s) => ({ ...s, base: e.target.value }))}
        />
        <Input
          className="h-9 text-sm"
          placeholder="Moneda secundaria"
          value={secondary}
          onChange={(e) => setSecondary(e.target.value.toUpperCase())}
        />
        <Input
          className="h-9 text-sm"
          placeholder="Redondeo (line/total)"
          value={state.rounding || ""}
          onChange={(e) => setState((s) => ({ ...s, rounding: e.target.value }))}
        />
      </div>
      <div className="grid md:grid-cols-4 gap-2">
        <Input
          className="h-9 text-sm"
          placeholder={`FX ${secondary || "USD"} (referencia)`}
          type="number"
          value={state.rates?.[secondary] ?? 0}
          onChange={(e) => setState((s) => ({ ...s, rates: { ...s.rates, [secondary]: Number(e.target.value || 0) } }))}
        />
        <Input
          className="h-9 text-sm"
          placeholder={`Compra ${secondary || "USD"}`}
          type="number"
          value={state.buy ?? 0}
          onChange={(e) => setState((s) => ({ ...s, buy: Number(e.target.value || 0) }))}
        />
        <Input
          className="h-9 text-sm"
          placeholder={`Venta ${secondary || "USD"}`}
          type="number"
          value={state.sell ?? 0}
          onChange={(e) => setState((s) => ({ ...s, sell: Number(e.target.value || 0) }))}
        />
      </div>
      <div className="flex gap-2">
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
