import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import useConfigStore from "../../../store/configStore";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const CURRENCIES = ["CRC", "USD", "EUR", "GBP", "MXN", "COP", "BRL", "ARS", "CLP", "PEN", "CAD", "JPY"];

export default function Currency() {
  const { t } = useLanguage();
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
  const [secondary, setSecondary] = useState(() => config.accounting.fx?.secondary || "USD");

  const currencyOptions = useMemo(
    () => CURRENCIES.map((code) => ({ value: code, label: t(`mgmt.currency.option.${code}`) })),
    [t]
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
      console.error(t("mgmt.currency.loadFailed"), err);
    }
  };

  useEffect(() => {
    const fx = config.accounting.fx || {};
    setState((prev) => ({
      ...prev,
      ...fx,
      rounding: typeof fx.rounding === "number" ? fx.rounding : prev.rounding ?? 2,
      enabled: typeof fx.enabled === "boolean" ? fx.enabled : prev.enabled ?? true,
    }));
    setSecondary(config.accounting.fx?.secondary || "USD");
  }, [config.accounting.fx]);

  useEffect(() => {
    load();
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
      <h3 className="font-medium">{t("mgmt.currency.title")}</h3>
      <p className="text-xs text-slate-500">{t("mgmt.currency.subtitle")}</p>

      <div className="space-y-3">
        <div className="space-y-1 max-w-[240px]">
          <label className="text-xs text-slate-500">{t("mgmt.currency.base")}</label>
          <Select value={state.base || "CRC"} onChange={(val) => setState((s) => ({ ...s, base: val }))} options={currencyOptions} />
        </div>

        <div className="space-y-1 max-w-[240px]">
          <label className="text-xs text-slate-500">{t("mgmt.currency.secondary")}</label>
          <Select value={secondary || "USD"} onChange={(val) => setSecondary(val)} options={currencyOptions} />
        </div>

        <div className="space-y-1 max-w-[180px]">
          <label className="text-xs text-slate-500">{t("mgmt.currency.rounding")}</label>
          <Input
            className="h-9 text-sm"
            type="number"
            min={0}
            max={6}
            placeholder={t("mgmt.currency.roundingPlaceholder")}
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

      <div className="grid md:grid-cols-4 gap-2">
        <Input
          className="h-9 text-sm"
          placeholder={t("mgmt.currency.fxReference", { secondary: secondary || "USD" })}
          money
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
          placeholder={t("mgmt.currency.buy", { secondary: secondary || "USD" })}
          money
          type="number"
          value={state.buy ?? 0}
          onChange={(e) => setState((s) => ({ ...s, buy: Number(e.target.value || 0) }))}
        />
        <Input
          className="h-9 text-sm"
          placeholder={t("mgmt.currency.sell", { secondary: secondary || "USD" })}
          money
          type="number"
          value={state.sell ?? 0}
          onChange={(e) => setState((s) => ({ ...s, sell: Number(e.target.value || 0) }))}
        />
      </div>

      <div className="mt-3 border rounded-lg px-3 py-2 bg-slate-50 space-y-2 text-xs text-slate-700">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={state.enabled ?? true}
            onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))}
          />
          <span>{t("mgmt.currency.enableAuto")}</span>
        </label>
        <div>
          {t("mgmt.currency.baseSummary")}: <strong>{state.base || "CRC"}</strong>
        </div>
        <div>
          {t("mgmt.currency.secondarySummary")}: <strong>{secondary || "USD"}</strong> - {t("mgmt.currency.buyLabel")}{" "}
          <strong>{formatAmount(state.buy)}</strong> - {t("mgmt.currency.sellLabel")} <strong>{formatAmount(state.sell)}</strong> -{" "}
          {t("mgmt.currency.decimals")} <strong>{decimals}</strong>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={load} disabled={saving}>
          {t("mgmt.currency.reload")}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? t("mgmt.currency.saving") : t("common.save")}
        </Button>
      </div>
    </Card>
  );
}
