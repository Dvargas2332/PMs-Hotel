import React from "react";
import { ImagePlus, X } from "lucide-react";
import { sanitizeImageUrl } from "../../lib/security";

/**
 * Imagen de una sección del restaurante.
 *
 * La dirección pegada a mano casi siempre termina siendo la página donde se vio
 * la imagen (una web), y el navegador no puede pintarla. Por eso acá se puede
 * subir el archivo: se reduce a 640 px y se guarda como data URL, igual que las
 * fotos de los artículos, así no depende de un servidor externo.
 */

const MAX_DIM = 640;
const QUALITY = 0.82;

function looksLikeImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (/^(data:image\/|blob:)/i.test(raw)) return true;
  return /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?(#.*)?$/i.test(raw);
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const shrink = (dataUrl) =>
  new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string") return resolve("");
    if (dataUrl.startsWith("data:image/svg+xml")) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      const w0 = Number(img.naturalWidth || img.width || 0);
      const h0 = Number(img.naturalHeight || img.height || 0);
      if (!w0 || !h0) return resolve(dataUrl);
      const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w0 * scale));
      canvas.height = Math.max(1, Math.round(h0 * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/webp", QUALITY));
      } catch {
        try {
          resolve(canvas.toDataURL("image/jpeg", QUALITY));
        } catch {
          resolve(dataUrl);
        }
      }
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });

export default function SectionImageField({ value, onChange, placeholder }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [broken, setBroken] = React.useState(false);
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    setBroken(false);
  }, [value]);

  const pick = async (file) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (!/^image\//i.test(file.type)) {
        setError("El archivo tiene que ser una imagen (JPG, PNG o WEBP).");
        return;
      }
      const raw = await readFileAsDataUrl(file);
      const resized = await shrink(raw);
      if (!resized) {
        setError("No se pudo leer la imagen. Probá con otro archivo.");
        return;
      }
      onChange(resized);
    } catch {
      setError("No se pudo cargar la imagen.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const preview = sanitizeImageUrl(value);
  const showWarning = value && !looksLikeImage(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
          placeholder={placeholder}
          value={String(value || "").startsWith("data:") ? "" : value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="h-9 shrink-0 px-3 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <ImagePlus className="h-4 w-4" />
          {busy ? "Subiendo..." : "Subir imagen"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="h-9 shrink-0 px-2 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-red-400"
            title="Quitar imagen"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {error && <div className="text-[11px] text-red-400">{error}</div>}
      {showWarning && !preview && (
        <div className="text-[11px] text-amber-500">
          Esa dirección no es una imagen. Subí el archivo o pegá el enlace directo (termina en .jpg, .png o .webp).
        </div>
      )}
      {preview && !broken ? (
        <img
          src={preview}
          alt="Vista previa de la sección"
          className="h-24 w-full max-w-[240px] rounded-lg border border-white/10 object-cover"
          onError={() => setBroken(true)}
        />
      ) : value && broken ? (
        <div className="text-[11px] text-amber-500">
          La dirección guardada no se puede mostrar. Subí la imagen para que se vea en el TPV.
        </div>
      ) : null}
    </div>
  );
}
