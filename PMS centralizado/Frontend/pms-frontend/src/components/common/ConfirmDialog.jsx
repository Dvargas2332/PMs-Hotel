// src/components/common/ConfirmDialog.jsx
export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
}) {
  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
      : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-xs rounded-2xl border border-indigo-100 bg-white p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
  
