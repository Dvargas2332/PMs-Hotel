//src/context/SettingsContext

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const SettingsCtx = createContext(null);
const LS_KEY = "pms.settings.cache.v1";

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/hotel");
      setSettings(data);
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      setError(e);
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setSettings(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (patch) => {
    const optimistic = { ...(settings||{}), ...patch };
    setSettings(optimistic);
    localStorage.setItem(LS_KEY, JSON.stringify(optimistic));
    const { data } = await api.put("/hotel", patch);
    setSettings(data);
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return data;
  }, [settings]);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => ({ settings, loading, error, reload: load, update }), [settings, loading, error, load, update]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}
export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings debe usarse dentro de <SettingsProvider>");
  return ctx;
}
