import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Search, X, User, Plus, Check } from "lucide-react";
import GuestForm from "./GuestForm";

export default function GuestPicker({ isOpen, onClose, onSelect, hotelId }) {
  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!query.trim()) {
      // Cargar últimos huéspedes al abrir sin búsqueda
      if (isOpen) {
        api.get("/guests").then(({ data }) => {
          setGuests(Array.isArray(data) ? data.slice(0, 20) : []);
        }).catch(() => setGuests([]));
      } else {
        setGuests([]);
      }
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/guests?q=${encodeURIComponent(query.trim())}`);
        setGuests(Array.isArray(data) ? data.slice(0, 20) : []);
      } catch { setGuests([]); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelect = (guest) => {
    setSelected(guest);
    onSelect(guest);
    onClose?.();
  };

  const handleCreate = async (data) => {
    try {
      const { data: newGuest } = await api.post("/guests", data);
      onSelect(newGuest);
      onClose?.();
    } catch (err) {
      throw err;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-2xl border shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
        style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-semibold" style={{ color: "var(--color-text-base)" }}>
            {showNewForm ? "Nuevo Huésped" : "Seleccionar Huésped"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {showNewForm ? (
          <div className="overflow-y-auto p-4">
            <GuestForm onSave={handleCreate} onCancel={() => setShowNewForm(false)} compact />
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm"
                  style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loading && (
                <div className="text-center py-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Buscando...</div>
              )}
              {!loading && guests.length === 0 && query && (
                <div className="text-center py-8">
                  <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>Sin resultados</p>
                  <button
                    onClick={() => setShowNewForm(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Plus size={15} /> Crear nuevo huésped
                  </button>
                </div>
              )}
              {guests.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleSelect(g)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${
                    selected?.id === g.id
                      ? "bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-400"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <User size={16} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-base)" }}>
                      {g.firstName} {g.lastName}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {[g.email, g.phone, g.idNumber].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </div>
                  </div>
                  {selected?.id === g.id && <Check size={16} className="text-emerald-500 shrink-0" />}
                </button>
              ))}
              {!query && !loading && (
                <div className="text-center py-8">
                  <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>Escribe para buscar huéspedes</p>
                  <button
                    onClick={() => setShowNewForm(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}
                  >
                    <Plus size={15} /> Crear nuevo huésped
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
