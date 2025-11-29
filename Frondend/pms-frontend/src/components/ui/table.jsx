//src/components/ui/table.jsx

import React from "react";
export function SimpleTable({ cols=[], rows=[], actions }) {
  return (
    <div className="overflow-x-auto border border-neutral-200 rounded-2xl bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>{cols.map(c => <th key={c.key} className="text-left px-4 py-2">{c.label}</th>)}
              {actions ? <th className="px-4 py-2">Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={r.id || i} className="border-t border-neutral-200">
              {cols.map(c => <td key={c.key} className="px-4 py-2">{r[c.key]}</td>)}
              {actions ? <td className="px-4 py-2">{actions(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
