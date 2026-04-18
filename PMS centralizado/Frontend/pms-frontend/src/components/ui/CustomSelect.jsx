import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const H_MAP = { "h-7": "1.75rem", "h-8": "2rem", "h-9": "2.25rem", "h-10": "2.5rem", "h-11": "2.75rem", "h-12": "3rem" };

export function CustomSelect({ value, onChange, children, options, className = "", style, disabled, title, placeholder, height }) {
  // Detect height from className (h-7, h-8, h-9, h-10...)
  const resolvedHeight = height ?? Object.entries(H_MAP).find(([cls]) => className.includes(cls))?.[1] ?? "2.25rem";
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const items = React.useMemo(() => {
    if (options) return options.map((o) => ({ value: String(o.value ?? ""), label: String(o.label ?? o.value ?? "") }));
    const result = [];
    React.Children.forEach(children, (child) => {
      if (!child) return;
      if (child.type === "option") {
        result.push({ value: String(child.props.value ?? ""), label: String(child.props.children ?? child.props.value ?? "") });
      } else if (child.type === "optgroup") {
        React.Children.forEach(child.props.children, (opt) => {
          if (opt?.type === "option") {
            result.push({ value: String(opt.props.value ?? ""), label: String(opt.props.children ?? opt.props.value ?? ""), group: child.props.label });
          }
        });
      }
    });
    return result;
  }, [children, options]);

  const selected = items.find((i) => i.value === String(value ?? ""));
  const displayLabel = selected?.label ?? placeholder ?? "";

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = (val) => {
    onChange?.({ target: { value: val } });
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className.includes("w-full") || className.includes("flex-1") ? "block" : "inline-block"} ${className}`} style={{ minWidth: 0, ...style }} title={title}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 text-sm"
        style={{
          height: resolvedHeight,
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: displayLabel ? "var(--color-text-base)" : "var(--color-text-muted)",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{displayLabel}</span>
        <ChevronDown
          className="shrink-0 w-3.5 h-3.5"
          style={{ color: "var(--color-text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 rounded-xl shadow-xl overflow-auto"
          style={{
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            maxHeight: "220px",
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          {items.map((item) => {
            const isSelected = item.value === String(value ?? "");
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleSelect(item.value)}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{
                  background: isSelected ? "rgba(99,102,241,0.15)" : "transparent",
                  color: isSelected ? "var(--color-text-base)" : "var(--color-text-muted)",
                  fontWeight: isSelected ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-2)"; e.currentTarget.style.color = "var(--color-text-base)"; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected ? "rgba(99,102,241,0.15)" : "transparent";
                  e.currentTarget.style.color = isSelected ? "var(--color-text-base)" : "var(--color-text-muted)";
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
