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
      // Reservas
      { id: "frontdesk.create_reservation", name: "Crear reservas" },
      { id: "frontdesk.reservation.edit", name: "Editar reservas" },
      { id: "frontdesk.reservation.cancel", name: "Cancelar reservas" },
      { id: "frontdesk.no_show.mark", name: "Marcar no‑show" },
  
      // Check-in / Check-out
      { id: "frontdesk.checkin", name: "Realizar check‑in" },
      { id: "frontdesk.checkout", name: "Realizar check‑out" },
      { id: "frontdesk.room.move", name: "Cambiar habitación de reserva" },
  
      // Huéspedes / perfiles
      { id: "frontdesk.guests.write", name: "Crear/editar perfiles de huésped" },
  
      // Cobros / pagos
      { id: "frontdesk.payments.apply", name: "Aplicar pagos y depósitos" },
  
      // Operaciones rápidas
      { id: "frontdesk.walkin.create", name: "Crear reservas walk‑in" },
    ],
  },
  
  {
    id: "restaurant",
    name: "Restaurante",
    access: { id: "restaurant.pos.open", name: "Acceso al POS de Restaurante" },
    permissions: [
      { id: "restaurant.menu.write", name: "Gestionar menú" },
      { id: "restaurant.sections.write", name: "Gestionar secciones/mesas" },
      { id: "restaurant.families.write", name: "Gestionar familias" },
      { id: "restaurant.items.write", name: "Gestionar artículos" },
      { id: "restaurant.inventory.write", name: "Gestionar inventario" },
      { id: "restaurant.recipes.write", name: "Gestionar recetas" },
      { id: "restaurant.orders.write", name: "Crear/editar órdenes" },
      { id: "restaurant.orders.move", name: "Mover órdenes entre mesas" },
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
    id: "einvoicing",
    name: "Facturación electrónica",
    access: { id: "einvoicing.access", name: "Acceso a facturación electrónica" },
    permissions: [
      { id: "einvoicing.issue", name: "Emitir comprobantes electrónicos" },
      { id: "einvoicing.cancel", name: "Anular comprobantes electrónicos" },
      { id: "einvoicing.reprint", name: "Reimprimir comprobantes electrónicos" },
      { id: "einvoicing.settings.write", name: "Configurar facturación electrónica" },
    ],
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
