//src/components/ui/toast.jsx

import React from "react";
export function Toast({ type="success", message }) {
  const styles = type==="error"
    ? "bg-red-600 text-white"
    : "bg-emerald-600 text-white";
  return <div className={`px-3 py-2 rounded-xl text-sm ${styles}`}>{message}</div>;
}
