//src/components/ui/tabs.jsx


import React, { useState } from "react";
import { cn } from "./lib/utils";

export function Tabs({ tabs, defaultTab, onChange }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.value);
  const current = tabs.find(t => t.value === active);

  const change = (val) => {
    setActive(val);
    onChange?.(val);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => change(t.value)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm transition shadow-soft",
              active===t.value ? "bg-black text-white" : "bg-white hover:bg-neutral-100"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
