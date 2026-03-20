// Utilidad para mostrar alertas consistentes usando el panel de Layout

export function pushAlert({
  type = "system",
  title = "",
  desc = "",
  kind = "",
} = {}) {
  if (!title && desc) title = desc;
  window.dispatchEvent(
    new CustomEvent("pms:push-alert", {
      detail: {
        type,
        title,
        desc,
        kind,
        at: new Date().toISOString(),
      },
    })
  );
}
