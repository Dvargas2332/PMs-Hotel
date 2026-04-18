// src/context/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const LS_KEY = "pms.theme.v1";
const ThemeCtx = createContext(null);

function applyTheme(mode) {
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_KEY) || "dark");

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(LS_KEY, theme);
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
