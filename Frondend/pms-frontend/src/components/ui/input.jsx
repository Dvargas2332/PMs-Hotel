import React from "react";

export function Input({ className = "", ...props }) {
    return <input className={`h-10 w-full rounded-xl border pl-3 pr-3 text-sm ${className}`} {...props} />;
  }
  