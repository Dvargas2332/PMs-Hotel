import React from "react";


export function Button({ variant = "default", className = "", type = "button", ...props }) {
  const base = "rounded-lg px-3 py-1.5 text-sm transition";
  const variants = {
    default: "bg-zinc-900 text-white hover:bg-zinc-800",
    outline: "border border-zinc-200 bg-white hover:bg-zinc-50",
    ghost: "text-zinc-700 hover:bg-zinc-100",
  };
  return <button type={type} className={`${base} ${variants[variant] ?? variants.default} ${className}`} {...props} />;
}
