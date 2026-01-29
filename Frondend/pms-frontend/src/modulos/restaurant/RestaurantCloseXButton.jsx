import React from "react";
import { X } from "lucide-react";

export default function RestaurantCloseXButton({ onClick, ariaLabel = "Close", className = "" }) {
  return (
    <button
      type="button"
      className={`h-8 w-8 rounded-full bg-lime-100 text-black text-lg leading-none flex items-center justify-center hover:bg-lime-200 ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <X className="h-4 w-4" />
    </button>
  );
}






