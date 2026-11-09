import { useEffect } from "react";

/**
 * Nada dentro del restaurante debe pedir autocompletado: los datos que se
 * escriben ahí son del turno (montos, mesas, clientes del local), no del
 * usuario del navegador. Chrome, LastPass y 1Password se guían por el tipo de
 * campo, así que se marcan todos los inputs y textareas de la pantalla, incluso
 * los que aparecen después en ventanas flotantes.
 */
export default function useNoAutocomplete() {
  useEffect(() => {
    let scheduled = false;

    const mark = () => {
      scheduled = false;
      const fields = document.querySelectorAll("input, textarea");
      fields.forEach((field) => {
        if (field.getAttribute("autocomplete") !== "off") field.setAttribute("autocomplete", "off");
        if (!field.hasAttribute("data-lpignore")) field.setAttribute("data-lpignore", "true");
        if (!field.hasAttribute("data-1p-ignore")) field.setAttribute("data-1p-ignore", "true");
        if (!field.hasAttribute("data-form-type")) field.setAttribute("data-form-type", "other");
        if (!field.hasAttribute("spellcheck")) field.setAttribute("spellcheck", "false");
      });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(mark);
      else mark();
    };

    mark();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}
