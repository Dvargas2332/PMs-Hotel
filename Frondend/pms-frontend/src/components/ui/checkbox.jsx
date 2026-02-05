//src/components/ui/checkbox.jsx


import React from "react";
export function Checkbox({ checked, onChange, onCheckedChange, label, ...props }) {
  const handleChange = (e) => {
    const value = e.target.checked;
    if (onChange) onChange(value);
    if (onCheckedChange) onCheckedChange(value);
  };
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!checked} onChange={handleChange} {...props} />
      {label}
    </label>
  );
}
