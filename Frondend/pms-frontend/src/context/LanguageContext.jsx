import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MESSAGES, SUPPORTED_LANGUAGES } from "../i18n/messages";

const LanguageContext = createContext(null);

function normalizeLang(code) {
  const supported = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
  return supported.has(code) ? code : "es";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() =>
    normalizeLang(localStorage.getItem("lang") || "es")
  );

  const setLang = (next) => {
    setLangState(normalizeLang(next));
  };

  useEffect(() => {
    localStorage.setItem("lang", lang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = "ltr";
    }
  }, [lang]);

  const t = useMemo(() => {
    const dict = MESSAGES[lang] ?? MESSAGES.es;
    return (key, vars) => {
      const template = dict[key] ?? MESSAGES.es[key] ?? key;
      if (!vars) return template;
      return Object.keys(vars).reduce(
        (acc, k) => acc.replaceAll(`{{${k}}}`, String(vars[k])),
        template
      );
    };
  }, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, languages: SUPPORTED_LANGUAGES }),
    [lang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de <LanguageProvider>");
  return ctx;
}
