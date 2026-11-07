import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, CheckCircle2, TriangleAlert } from "lucide-react";
import { http } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { Input } from "../components/ui/input";

export default function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState(token ? "form" : "invalid"); // form | invalid | done
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) {
      setErr(t("resetPassword.weak"));
      return;
    }
    if (password !== confirm) {
      setErr(t("resetPassword.mismatch"));
      return;
    }
    setSaving(true);
    try {
      await http.post("/auth/reset-password", { token, password });
      setStatus("done");
    } catch (ex) {
      setErr(ex?.response?.data?.message || t("resetPassword.error"));
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
        {status === "invalid" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <TriangleAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
              {t("resetPassword.invalidTitle")}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {t("resetPassword.invalidBody")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/forgot-password", { replace: true })}
              className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
            >
              {t("resetPassword.requestNew")}
            </button>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
              {t("resetPassword.doneTitle")}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {t("resetPassword.doneBody")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
            >
              {t("resetPassword.goLogin")}
            </button>
          </div>
        )}

        {status === "form" && (
          <>
            <div className="space-y-1 mb-6">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-base)" }}>
                  {t("resetPassword.title")}
                </h1>
              </div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {t("resetPassword.subtitle")}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>
                  {t("resetPassword.password")}
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
                  {t("resetPassword.confirm")}
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
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
              >
                {saving ? t("resetPassword.saving") : t("resetPassword.save")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
