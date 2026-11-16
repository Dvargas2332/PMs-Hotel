import React, { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  getAgentStatus,
  getPrintAgentConfig,
  listPrintersFromAgent,
  printTextToAgent,
  setPrintAgentConfig,
} from "../../lib/printAgent";

/**
 * ConexiÃ³n con el Print Agent de esta caja.
 *
 * El agente es un programa aparte que se instala en la computadora de la caja y
 * habla con la impresora. La direcciÃ³n y la clave son de esa mÃ¡quina, no del
 * hotel, asÃ­ que se guardan en este navegador y no en la configuraciÃ³n del
 * restaurante (que es la misma para todas las cajas).
 */

const TEST_TEXT = [
  "==========================================",
  "          PRUEBA DE IMPRESION",
  "==========================================",
  "PMS Kazehana - Print Agent",
  "Si lee esto, la caja ya puede imprimir",
  "comandas, tiquetes y cierres.",
  "==========================================",
  "",
  "",
].join("\n");

export default function PrintAgentPanel({ printers, onSetPrinter }) {
  const [cfg, setCfg] = useState(() => getPrintAgentConfig());
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  const run = async (task) => {
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      await task();
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "No se pudo hablar con el agente." });
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      setPrintAgentConfig({ url: cfg.url, key: cfg.key, mode: cfg.mode });
      const status = await getAgentStatus({ agentUrl: cfg.url });
      const found = await listPrintersFromAgent({ agentUrl: cfg.url, apiKey: cfg.key });
      setList(found);
      setMsg({
        type: "ok",
        text: `Agente "${status.agent_id || "conectado"}" â€” ${found.length} impresora(s) instalada(s).`,
      });
    });

  const testPrint = () =>
    run(async () => {
      setPrintAgentConfig({ url: cfg.url, key: cfg.key, mode: cfg.mode });
      const target = String(printers?.cashierPrinter || list[0]?.name || "").trim();
      if (!target) throw new Error("Primero elige la impresora de caja.");
      await printTextToAgent({ agentUrl: cfg.url, printerName: target, text: TEST_TEXT });
      setMsg({ type: "ok", text: `Prueba enviada a "${target}".` });
    });

  const assign = (field, name) => {
    onSetPrinter?.(field, name);
    setMsg({ type: "ok", text: `"${name}" quedÃ³ como ${field === "kitchenPrinter" ? "cocina" : field === "barPrinter" ? "barra" : "caja"}. Guarda la configuraciÃ³n para conservarlo.` });
  };

  return (
    <div className="pt-3 border-t space-y-3">
      <div>
        <div className="text-sm font-semibold">Agente de impresiÃ³n (esta caja)</div>
        <p className="text-xs text-slate-400">
          El agente debe estar corriendo en esta computadora. La direcciÃ³n y la clave se guardan en este
          navegador, no en la configuraciÃ³n del hotel.
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <label className="text-sm">
          <div className="text-xs text-slate-400 mb-1">DirecciÃ³n del agente</div>
          <Input
            value={cfg.url}
            placeholder="http://127.0.0.1:8787"
            onChange={(e) => setCfg((c) => ({ ...c, url: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-slate-400 mb-1">Clave local</div>
          <Input
            type="password"
            autoComplete="new-password"
            value={cfg.key}
            onChange={(e) => setCfg((c) => ({ ...c, key: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-slate-400 mb-1">Tipo de impresora</div>
          <select
            className="h-10 w-full rounded-lg border px-3 text-sm"
            value={cfg.mode}
            onChange={(e) => setCfg((c) => ({ ...c, mode: e.target.value }))}
          >
            <option value="escpos">TÃ©rmica (ESC/POS)</option>
            <option value="html">Documento 80 mm</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="button" disabled={busy} onClick={connect}>
            Probar conexiÃ³n
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={testPrint}>
            Imprimir prueba
          </Button>
        </div>
      </div>

      {msg.text && (
        <div className={`text-xs ${msg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>{msg.text}</div>
      )}

      {list.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="text-xs text-slate-400 mb-2">Impresoras instaladas â€” elige a dÃ³nde va cada papel</div>
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.name} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.alias ? <span className="text-xs text-slate-400">({p.alias})</span> : null}
                <span className="ml-auto flex gap-1">
                  <Button type="button" variant="outline" onClick={() => assign("kitchenPrinter", p.name)}>
                    Cocina
                  </Button>
                  <Button type="button" variant="outline" onClick={() => assign("barPrinter", p.name)}>
                    Barra
                  </Button>
                  <Button type="button" variant="outline" onClick={() => assign("cashierPrinter", p.name)}>
                    Caja
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
