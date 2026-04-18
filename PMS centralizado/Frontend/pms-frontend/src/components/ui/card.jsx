import React from "react";
export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        color: "var(--color-text-base)",
      }}
      {...props}
    />
  );
}
