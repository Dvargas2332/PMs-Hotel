import React from "react";


export function TooltipProvider({ children }) { return <>{children}</>; }
export function Tooltip({ children }) { return <div className="relative inline-block">{children}</div>; }
export function TooltipTrigger({ asChild, children, ...props }) {
  return asChild ? React.cloneElement(children, props) : <button {...props}>{children}</button>;
}
export function TooltipContent({ children, className = "", ...props }) {
  return (
    <div className={`absolute z-50 mt-1 rounded-md border bg-white px-2 py-1 text-xs shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}
