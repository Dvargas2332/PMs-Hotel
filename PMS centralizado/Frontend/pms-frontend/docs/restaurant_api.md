# API restaurante (multi-hotel, aislado por hotel_id)

Todas las peticiones deben llevar hotel_id (claim del token o header X-Hotel-Id). Ningun recurso cruza datos entre hoteles.

## Configuracion (Management)
- GET/PUT /restaurant/config: impresoras (kitchen/bar), defaults de POS.
- GET/PUT /restaurant/taxes: IVA, servicio, descuentos.
- GET/PUT /restaurant/payments: metodos activos, monedas, tipo de cambio.
- GET/PUT /restaurant/general y /restaurant/billing: datos legales y facturacion.
- CRUD secciones/mesas: GET/POST /restaurant/sections, POST /restaurant/sections/:id/tables, DELETE /restaurant/sections/:id y /restaurant/sections/:id/tables/:tableId.
- CRUD catalogo: /restaurant/items, /restaurant/categories, /restaurant/recipes, /restaurant/inventory.

## POS / Operacion
- GET /restaurant/menu?section=<id>&serviceType=: items visibles por seccion y tipo de servicio.
- GET /restaurant/orders?status=&section=: ordenes abiertas (POS/KDS).
- POST /restaurant/order: crear/actualizar orden abierta (items, covers, note, service_type, room_id opcional).
- POST /restaurant/order/send: marca IN_KITCHEN y encola en KDS/impresoras.
- POST /restaurant/order/close: cierra, genera pagos (CASH/CARD/SINPE/TRANSFER/ROOM), descarga inventario y opcional factura/tiquete.
- POST /restaurant/order/charge-room: valida habitacion activa (Front Desk), crea pago ROOM y asiento en ledger.
- POST /restaurant/close: cierre de caja restaurante (totals_system, totals_reported, breakdown).
- GET /restaurant/close: historial de cierres.
- GET /restaurant/stats: ventas, ordenes abiertas, totales por metodo.

## KDS
- GET /restaurant/kds?area=KITCHEN|BAR: items en IN_KITCHEN/SERVED.
- PATCH /restaurant/kds/:orderItemId body {status: READY|SERVED}.

## Reportes
- Ventas por rango, categoria, plato, mesero, servicio (dine_in/takeout/delivery/room), hora.
- Pagos por metodo y conciliacion vs cierres.
- Consumos/mermas (recipes + inventario).
- Cargos a habitacion (cruce con Front Desk/ledger).

## Seguridad / Roles
- Permisos sugeridos: 
estaurant.pos.*, 
estaurant.kds.*, 
estaurant.inventory.*, 
estaurant.config.*.
- Siempre filtrar por hotel_id y user.role.
