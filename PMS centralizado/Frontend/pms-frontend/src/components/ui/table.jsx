//src/components/ui/table.jsx

import React from "react";
export function SimpleTable({ cols = [], rows = [], actions }) {
  return (
    <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--card-border)", background: "var(--color-surface-2)" }}>
      <table className="min-w-full text-sm" style={{ color: "var(--color-text-base)" }}>
        <thead style={{ background: "var(--table-head-bg)", color: "var(--color-text-muted)" }}>
          <tr>
            {cols.map(c => <th key={c.key} className="text-left px-4 py-2">{c.label}</th>)}
            {actions ? <th className="px-4 py-2">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className="transition-colors" style={{ borderTop: "1px solid var(--card-border)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--table-row-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              {cols.map(c => <td key={c.key} className="px-4 py-2">{r[c.key]}</td>)}
              {actions ? <td className="px-4 py-2">{actions(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
