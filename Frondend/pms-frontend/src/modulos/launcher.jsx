import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, Bell, Hotel, Settings, Banknote, UtensilsCrossed } from "lucide-react";

import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

export default function Launcher() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef(null);

  const modules = useMemo(
    () => [
      { name: "Front Desk", path: "/frontdesk", icon: Hotel, description: "Check-in/out, planning y reservas.", tag: "Operación" },
      { name: "Management", path: "/management", icon: Settings, description: "Tarifas, usuarios, permisos.", tag: "Admin" },
      { name: "Accounting", path: "/accounting", icon: Banknote, description: "Facturación y reportes.", tag: "Finanzas" },
      { name: "Restaurant", path: "/restaurant", icon: UtensilsCrossed, description: "Órdenes y mesas.", tag: "F&B" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q));
  }, [modules, query]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setFocusedIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && focusedIndex >= 0) { navigate(filtered[focusedIndex].path); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIndex, navigate]);

  const openModule = (path) => navigate(path);

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-gray-100">
        {/* Header */}
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow">
              <Hotel size={18} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">User</h1>
              <p className="text-xs text-gray-600">Pulsa <kbd className="rounded border border-gray-400 px-1 text-[10px]">/</kbd> para buscar</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
            <Bell size={14} className="text-green-600" /> 3
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-6">
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((mod, idx) => (
              <ModuleCard key={mod.name} mod={mod} focused={idx === focusedIndex} onOpen={() => openModule(mod.path)} />
            ))}
          </div>
        </main>

        <footer className="mx-auto my-8 w-full max-w-6xl px-6 text-[11px] text-gray-600">
          <div className="flex items-center justify-between">
            <span>© {new Date().getFullYear()} PMS hotel prueba </span>
            <span className="hidden sm:inline-flex items-center gap-1"> </span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

function ModuleCard({ mod, onOpen, focused }) {
  const Icon = mod.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onOpen}
          className={`text-left transition focus:outline-none ${focused ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
        >
          <Card className="rounded-xl border border-gray-300 bg-white p-4 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-[15px] font-medium text-gray-900">{mod.name}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{mod.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-sm text-[10px] border-gray-300 text-gray-700">{mod.tag}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <span>Entrar</span>
                <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="text-[11px] text-gray-400">{mod.path}</div>
            </div>
          </Card>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="rounded-lg text-xs bg-white border border-gray-300 text-gray-700 shadow">
        Abrir {mod.name}
      </TooltipContent>
    </Tooltip>
  );
}
