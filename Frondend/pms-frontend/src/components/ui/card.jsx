import React from "react";



export function Card({ className = "", ...props }) {
    return <div className={`rounded-xl border p-4 white-sm ${className}`} {...props} />;
  }
  