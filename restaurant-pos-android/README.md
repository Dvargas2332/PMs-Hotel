# PMS Restaurante POS (Android)

App Android (kiosco) enfocada solo en el módulo de **Restaurante / Punto de venta**, consumiendo el backend en `.../api`.

## Requisitos
- Android Studio (con JDK 17).
- Backend corriendo y accesible desde la red del dispositivo.

## Configuración rápida
1. Abre `restaurant-pos-android/` en Android Studio.
2. Ejecuta en un emulador/tableta.
3. En la primera pantalla, configura la **Base URL**:
   - Emulador: `http://10.0.2.2:4000/api`
   - Dispositivo en LAN: `http://IP_DEL_SERVIDOR:4000/api`

## Login
La app usa el login de **Launcher** (usuario + PIN):
- Endpoint: `POST /api/launcher/login`

Necesitas crear una cuenta de launcher para el hotel (desde tu Management o por API usando los endpoints de `GET/POST /api/launcher`).

## Permisos mínimos (rol del launcher)
- `restaurant.pos.open` (para ver secciones/menú)
- `restaurant.orders.write` (para crear/actualizar órdenes)
- `restaurant.orders.close` (para cobrar/cerrar órdenes)
- `restaurant.shift.close` (para cerrar caja; adicionalmente el backend restringe a rol `ADMIN`/`MANAGER`)

## Notas
- La app permite tráfico HTTP (`android:usesCleartextTraffic="true"`) para LAN. Para producción, recomienda HTTPS.
