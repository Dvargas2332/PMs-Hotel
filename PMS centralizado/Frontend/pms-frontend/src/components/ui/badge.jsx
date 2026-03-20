import React from "react";  


export function Badge({ variant = "default", className = "", ...props }) {
    const styles = variant === "outline"
      ? "border border-zinc-200 text-zinc-700"
      : "bg-zinc-900 text-white";
    return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${styles} ${className}`} {...props} />;
  }
  