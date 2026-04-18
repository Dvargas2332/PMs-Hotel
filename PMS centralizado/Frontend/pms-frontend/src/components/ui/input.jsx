import React from "react";
import { normalizeMoneyInput } from "../../lib/money";

export function Input({ className = "", money = false, onBlur, onChange, type, inputMode, pattern, ...props }) {
  const handleBlur = (e) => {
    if (money) {
      const normalized = normalizeMoneyInput(e.target.value);
      if (normalized !== e.target.value) {
        e.target.value = normalized;
        if (onChange) {
          onChange({ ...e, target: { ...e.target, value: normalized }, currentTarget: { ...e.target, value: normalized } });
        }
      }
    }
    if (onBlur) onBlur(e);
  };

  const nextType = money ? "text" : type;
  const nextInputMode = money ? "decimal" : inputMode;
  const nextPattern = money ? "[0-9.,-]*" : pattern;

  return (
    <input
      className={`h-10 w-full rounded-xl text-sm pl-3 pr-3 placeholder:text-[var(--color-text-muted)] ${className}`}
      style={{
        background: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--color-text-base)",
      }}
      {...props}
      type={nextType}
      inputMode={nextInputMode}
      pattern={nextPattern}
      onChange={onChange}
      onBlur={handleBlur}
    />
  );
}
