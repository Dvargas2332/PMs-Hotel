//src/components/ui/checkbox.jsx


import React from "react";
export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!checked} onChange={e=>onChange?.(e.target.checked)} />
      {label}
    </label>
  );
}
