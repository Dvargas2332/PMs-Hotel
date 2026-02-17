//src/components/ui/textarea.jsx

import React from "react";

export function Textarea({ value, onChange, rows = 3, placeholder, className = "", ...props }) {
  return (
      <textarea
        rows={rows}
        className={`w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm ${className}`}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
  );
}
