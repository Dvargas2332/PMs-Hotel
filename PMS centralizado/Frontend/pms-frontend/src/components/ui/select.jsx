//src/components/ui/select.jsx

import React from "react";
export function Select({ value, onChange, options = [], className = "" }) {
  return (
    <select
      className={`h-11 rounded-2xl px-3 text-sm ${className}`}
      style={{
        background: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--color-text-base)",
      }}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
