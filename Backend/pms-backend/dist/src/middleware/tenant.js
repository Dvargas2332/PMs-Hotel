// src/middleware/tenant.ts
export function tenantCtx(req, _res, next) {
    // Preferimos el hotelId del usuario autenticado; fallback al header opcional
    const hotelIdFromUser = req?.user?.hotelId;
    const headerHotel = req.headers["x-tenant-id"];
    req.tenantId = hotelIdFromUser ?? headerHotel ?? "default";
    next();
}
