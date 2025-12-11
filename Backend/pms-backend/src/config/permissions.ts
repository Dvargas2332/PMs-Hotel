// src/config/permissions.ts
// Definimos los permisos disponibles, agrupados por módulo para que el management pueda construir perfiles.

export type PermissionDef = { id: string; name: string };
export type PermissionModule = {
  id: string;
  name: string;
  access: PermissionDef; // permiso mínimo para entrar al módulo
  permissions: PermissionDef[]; // permisos granulares dentro del módulo
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "frontdesk",
    name: "Frontdesk",
    access: { id: "frontdesk.read", name: "Acceso a Frontdesk" },
    permissions: [
      { id: "frontdesk.create_reservation", name: "Crear/editar reservas y huéspedes" },
      { id: "frontdesk.checkin", name: "Check-in" },
      { id: "frontdesk.checkout", name: "Check-out / Cancelar" },
    ],
  },
  {
    id: "restaurant",
    name: "Restaurante",
    access: { id: "restaurant.pos.open", name: "Acceso a POS Restaurante" },
    permissions: [
      { id: "restaurant.menu.write", name: "Gestionar menú" },
      { id: "restaurant.sections.write", name: "Gestionar secciones/mesas" },
      { id: "restaurant.orders.write", name: "Crear/editar órdenes" },
      { id: "restaurant.orders.close", name: "Cerrar/pagar órdenes" },
      { id: "restaurant.print", name: "Enviar a impresoras" },
      { id: "restaurant.shift.close", name: "Cerrar turno" },
      { id: "restaurant.config.write", name: "Configurar impresoras" },
    ],
  },
  {
    id: "accounting",
    name: "Contabilidad",
    access: { id: "accounting.read", name: "Acceso a contabilidad" },
    permissions: [],
  },
  {
    id: "management",
    name: "Management",
    access: { id: "management.settings.write", name: "Administrar configuración" },
    permissions: [
      { id: "management.settings.write", name: "Administrar hotel, roles y permisos" },
    ],
  },
];

// Lista plana de todos los permisos (incluye los de acceso a módulo)
export const ALL_PERMISSIONS = Array.from(
  new Set(
    PERMISSION_MODULES.flatMap((m) => [m.access.id, ...m.permissions.map((p) => p.id)])
  )
);
