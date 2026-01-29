import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function Login({ onSuccess }) {
  const { login } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (loading) return;
    setLoading(true);
    try {
      const payload = await login(email, password);
      const isGestor = Boolean(payload?.isGestor);
      let next = searchParams.get("next") || (isGestor ? "/launchergestor" : "/launcher");
      if (isGestor && next.startsWith("/launcher")) next = "/launchergestor";
      onSuccess?.();
      navigate(next, { replace: true });
    } catch {
      setErr(t("login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <div className="absolute left-4 top-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
          onClick={() => alert(t("login.infoSoon"))}
        >
          <Info size={14} className="text-emerald-600" />
          {t("common.info")}
        </button>
      </div>

      <div className="absolute right-4 top-4">
        <label className="text-xs text-slate-600 mr-2">{t("common.language")}</label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm max-w-[160px]"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full max-w-5xl rounded-3xl border bg-white shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 p-8 flex items-center justify-center">
          <img
            src="/kazehanalogo.png"
            alt="Kazehana PMS"
            className="h-72 w-72 object-contain drop-shadow-2xl"
          />
        </div>

        <div className="p-8 md:p-10">
          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">{t("login.title")}</h1>
            <p className="text-sm text-slate-600">{t("login.subtitle")}</p>
          </div>

          <Card className="p-6 shadow-lg border border-slate-200/80">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{t("login.email")}</label>
                <Input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  {t("login.password")}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  required
                />
              </div>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="h-4 w-4 mr-2" />
                {loading ? t("login.signingIn") : t("common.enter")}
              </Button>

              
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
