import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ShieldCheck, TriangleAlert, LogIn } from "lucide-react";
import { http } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { Input } from "../components/ui/input";

export default function AcceptInvite() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("loading"); // loading | form | invalid | done
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setStatus("invalid");
        return;
      }
      try {
        const { data } = await http.get(`/auth/invite/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setInvite(data);
        setStatus("form");
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) {
      setErr(t("acceptInvite.weak"));
      return;
    }
    if (password !== confirm) {
      setErr(t("acceptInvite.mismatch"));
      return;
    }
    setSaving(true);
    try {
      await http.post("/auth/accept-invite", { token, password });
      setStatus("done");
    } catch (ex) {
      const message = ex?.response?.data?.message;
      setErr(message || t("acceptInvite.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--shell-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl p-8"
        style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)" }}
      >
        {status === "loading" && (
          <p className="text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
            {t("acceptInvite.loading")}
          </p>
        )}

        {status === "invalid" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <TriangleAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
              {t("acceptInvite.invalidTitle")}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {t("acceptInvite.invalidBody")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
            >
              {t("acceptInvite.goLogin")}
            </button>
          </div>
        )}

        {status === "form" && (
          <>
            <div className="space-y-1 mb-6">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-base)" }}>
                  {t("acceptInvite.title")}
                </h1>
              </div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {t("acceptInvite.subtitle")}
              </p>
            </div>

            <div className="space-y-1 mb-4">
              <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>
                {t("acceptInvite.email")}
              </label>
              <Input value={invite?.email || ""} readOnly disabled />
            </div>

            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>
                  {t("acceptInvite.password")}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>
                  {t("acceptInvite.confirm")}
                </label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="********"
                  autoComplete="new-password"
                  required
                />
              </div>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{saving ? t("acceptInvite.submitting") : t("acceptInvite.submit")}</span>
              </button>
            </form>
          </>
        )}

        {status === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
              {t("acceptInvite.successTitle")}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {t("acceptInvite.successBody").replace("{{email}}", invite?.email || "")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>{t("acceptInvite.goLogin")}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
