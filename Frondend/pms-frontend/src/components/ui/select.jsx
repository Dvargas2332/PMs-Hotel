//src/components/ui/select.jsx

import React from "react";
export function Select({ value, onChange, options = [] }) {
  return (
    <select className="h-11 rounded-2xl border border-neutral-300 bg-white px-3 text-sm"
      value={value ?? ""} onChange={e => onChange?.(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
