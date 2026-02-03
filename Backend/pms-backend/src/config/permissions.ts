// src/config/permissions.ts
// Definimos los permisos disponibles, agrupados por mÃ³dulo para que el management pueda construir perfiles.

export type PermissionDef = { id: string; name: string };
export type PermissionModule = {
  id: string;
  name: string;
  access: PermissionDef; // permiso mÃ­nimo para entrar al mÃ³dulo
  permissions: PermissionDef[]; // permisos granulares dentro del mÃ³dulo
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
      { id: "frontdesk.no_show.mark", name: "Marcar noâ€‘show" },
  
      // Check-in / Check-out
      { id: "frontdesk.checkin", name: "Realizar checkâ€‘in" },
      { id: "frontdesk.checkout", name: "Realizar checkâ€‘out" },
      { id: "frontdesk.room.move", name: "Cambiar habitaciÃ³n de reserva" },
  
      // HuÃ©spedes / perfiles
      { id: "frontdesk.guests.write", name: "Crear/editar perfiles de huÃ©sped" },
  
      // Cobros / pagos
      { id: "frontdesk.payments.apply", name: "Aplicar pagos y depÃ³sitos" },
  
      // Operaciones rÃ¡pidas
      { id: "frontdesk.walkin.create", name: "Crear reservas walkâ€‘in" },
    ],
  },
  
  {
    id: "restaurant",
    name: "Restaurante",
    access: { id: "restaurant.pos.open", name: "Acceso al POS de Restaurante" },
    permissions: [
      { id: "restaurant.access.pos", name: "Acceso a POS" },
      { id: "restaurant.access.kds", name: "Acceso a KDS" },
      { id: "restaurant.access.history", name: "Acceso a historico" },
      { id: "restaurant.access.closes", name: "Acceso a cierres" },
      { id: "restaurant.access.inventory", name: "Acceso a inventario" },
      { id: "restaurant.access.reprints", name: "Acceso a reimpresiones" },
      { id: "restaurant.menu.write", name: "Gestionar menÃº" },
      { id: "restaurant.sections.write", name: "Gestionar secciones/mesas" },
      { id: "restaurant.families.write", name: "Gestionar familias" },
      { id: "restaurant.items.write", name: "Gestionar artÃ­culos" },
      { id: "restaurant.inventory.write", name: "Gestionar inventario" },
      { id: "restaurant.recipes.write", name: "Gestionar recetas" },
      { id: "restaurant.orders.write", name: "Crear/editar Ã³rdenes" },
      { id: "restaurant.orders.move", name: "Mover Ã³rdenes entre mesas" },
      { id: "restaurant.orders.close", name: "Cerrar/pagar Ã³rdenes" },
      { id: "restaurant.orders.cancel", name: "Anular ordenes" },
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
    name: "FacturaciÃ³n electrÃ³nica",
    access: { id: "einvoicing.access", name: "Acceso a facturaciÃ³n electrÃ³nica" },
    permissions: [
      { id: "einvoicing.issue", name: "Emitir comprobantes electrÃ³nicos" },
      { id: "einvoicing.cancel", name: "Anular comprobantes electrÃ³nicos" },
      { id: "einvoicing.reprint", name: "Reimprimir comprobantes electrÃ³nicos" },
      { id: "einvoicing.settings.write", name: "Configurar facturaciÃ³n electrÃ³nica" },
    ],
  },
  {
    id: "management",
    name: "Management",
    access: { id: "management.settings.write", name: "Administrar configuraciÃ³n" },
    permissions: [
      { id: "management.settings.write", name: "Administrar hotel, roles y permisos" },
    ],
  },
];

// Lista plana de todos los permisos (incluye los de acceso a mÃ³dulo)
export const ALL_PERMISSIONS = Array.from(
  new Set(
    PERMISSION_MODULES.flatMap((m) => [m.access.id, ...m.permissions.map((p) => p.id)])
  )
);

