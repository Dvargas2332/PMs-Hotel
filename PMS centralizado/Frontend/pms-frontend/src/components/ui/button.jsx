import React from "react";


export function Button({ variant = "default", className = "", type = "button", ...props }) {
  const base = "rounded-lg px-3 py-1.5 text-sm transition";
  const variants = {
    default: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-sm",
    outline: "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
    ghost: "text-slate-300 hover:bg-white/10",
    secondary: "bg-white/10 text-slate-200 hover:bg-white/15",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-700",
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant] ?? variants.default} ${className}`}
      {...props}
    />
  );
}
