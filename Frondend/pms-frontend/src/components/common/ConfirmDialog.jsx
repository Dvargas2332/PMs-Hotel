// src/components/common/ConfirmDialog.jsx
export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onCancel} className="rounded-lg border px-3 py-1.5 text-sm">Cancel</button>
            <button onClick={onConfirm} className="rounded-lg bg-black px-3 py-1.5 text-sm text-white">Confirm</button>
          </div>
        </div>
      </div>
    );
  }
  
