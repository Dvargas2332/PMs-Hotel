// src/config/permissions.ts
// Definimos los permisos disponibles, agrupados por m?dulo para que el management pueda construir perfiles.

export type PermissionDef = { id: string; name: string };
export type PermissionModule = {
  id: string;
  name: string;
  access: PermissionDef; // permiso m?nimo para entrar al m?dulo
  permissions: PermissionDef[]; // permisos granulares dentro del m?dulo
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
      { id: "frontdesk.room.move", name: "Cambiar habitaci?n de reserva" },
  
      // Hu?spedes / perfiles
      { id: "frontdesk.guests.write", name: "Crear/editar perfiles de hu?sped" },
  
      // Cobros / pagos
      { id: "frontdesk.payments.apply", name: "Aplicar pagos y dep?sitos" },
  
      // Operaciones r?pidas
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
      // Una por cada seccion de Management -> Restaurante. Asi se le puede dar a
      // un perfil solo la parte que trabaja (por ejemplo, articulos y familias).
      { id: "restaurant.config.general.write", name: "Configurar informacion general del restaurante" },
      { id: "restaurant.config.billing.write", name: "Configurar facturacion y comprobantes" },
      { id: "restaurant.config.payments.write", name: "Configurar pagos, divisas y formas de cobro" },
      { id: "restaurant.config.taxes.write", name: "Configurar impuestos y descuentos" },
      { id: "restaurant.tables.write", name: "Gestionar mesas y plano del salon" },
      { id: "restaurant.menus.write", name: "Gestionar menus y horarios" },
      { id: "restaurant.printing.write", name: "Configurar impresoras y plantillas" },
      { id: "restaurant.clients.write", name: "Gestionar clientes del restaurante" },
      { id: "restaurant.history.read", name: "Ver historico, cierres y reimpresiones" },
      { id: "restaurant.menu.write", name: "Gestionar menu" },
      { id: "restaurant.sections.write", name: "Gestionar secciones" },
      { id: "restaurant.families.write", name: "Gestionar familias" },
      { id: "restaurant.items.write", name: "Gestionar articulos" },
      { id: "restaurant.inventory.write", name: "Gestionar inventario" },
      { id: "restaurant.recipes.write", name: "Gestionar recetas" },
      { id: "restaurant.orders.write", name: "Crear/editar ordenes" },
      { id: "restaurant.orders.move", name: "Mover ordenes entre mesas" },
      { id: "restaurant.orders.edit_price", name: "Editar precios de articulos" },
      { id: "restaurant.orders.discount", name: "Aplicar descuentos sobre el maximo" },
      { id: "restaurant.orders.close", name: "Cerrar/pagar ordenes" },
      { id: "restaurant.orders.cancel", name: "Anular ordenes" },
      { id: "restaurant.staff.write", name: "Gestionar cajeros y meseros" },
      { id: "restaurant.print", name: "Enviar a impresoras" },
      { id: "restaurant.shift.closeX", name: "Cerrar turno (Cierre X)" },
      { id: "restaurant.shift.closeZ", name: "Cerrar turno (Cierre Z)" },
      { id: "restaurant.shift.closeZ.force", name: "Forzar Cierre Z con diferencias" },
      { id: "restaurant.shift.close", name: "Cerrar turno (Legacy)" },
      { id: "restaurant.config.write", name: "Configurar el restaurante" },
    ],
  },
  {
    id: "accounting",
    name: "Contabilidad",
    access: { id: "accounting.read", name: "Acceso a contabilidad" },
    permissions: [
      { id: "accounting.accounts.write", name: "Crear y editar el plan de cuentas" },
      { id: "accounting.entries.write", name: "Capturar y corregir asientos" },
      { id: "accounting.entries.approve", name: "Contabilizar asientos" },
      { id: "accounting.entries.void", name: "Anular asientos" },
      { id: "accounting.settings.write", name: "Configurar contabilidad, períodos y cierres" },
    ],
  },
  {
    id: "einvoicing",
    name: "Facturaci?n electr?nica",
    access: { id: "einvoicing.access", name: "Acceso a facturaci?n electr?nica" },
    permissions: [
      { id: "einvoicing.issue", name: "Emitir comprobantes electr?nicos" },
      { id: "einvoicing.cancel", name: "Anular comprobantes electr?nicos" },
      { id: "einvoicing.reprint", name: "Reimprimir comprobantes electr?nicos" },
      { id: "einvoicing.settings.write", name: "Configurar facturaci?n electr?nica" },
    ],
  },
  {
    id: "management",
    name: "Management",
    access: { id: "management.settings.write", name: "Administrar configuraci?n" },
    permissions: [
      { id: "management.settings.write", name: "Administrar hotel, roles y permisos" },
    ],
  },
];

// Lista plana de todos los permisos (incluye los de acceso a m?dulo)
export const ALL_PERMISSIONS = Array.from(
  new Set(
    PERMISSION_MODULES.flatMap((m) => [m.access.id, ...m.permissions.map((p) => p.id)])
  )
);

