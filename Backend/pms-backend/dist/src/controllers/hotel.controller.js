// hotel.controller.ts
import { prisma } from "../lib/prisma";
function resolveHotelId(req) {
    // @ts-ignore
    const user = req.user;
    return req.params?.hotelId ?? user?.hotelId;
}
// GET /api/hotel
export async function getHotel(req, res) {
    const hotelId = resolveHotelId(req);
    if (!hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel)
        return res.status(404).json({ message: "Hotel no encontrado" });
    res.json(hotel);
}
// PUT /api/hotel
export async function updateHotel(req, res) {
    const hotelId = resolveHotelId(req);
    if (!hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const { name, currency } = req.body;
    const hotel = await prisma.hotel.update({
        where: { id: hotelId },
        data: { name, currency },
    });
    res.json(hotel);
}
// GET /api/hotel/currency
export async function getCurrency(req, res) {
    const hotelId = resolveHotelId(req);
    if (!hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const hotel = await prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { currency: true, fxBuy: true, fxSell: true },
    });
    if (!hotel)
        return res.status(404).json({ message: "Hotel no encontrado" });
    res.json({
        base: hotel.currency,
        buy: Number(hotel.fxBuy || 0),
        sell: Number(hotel.fxSell || 0),
    });
}
// PUT /api/hotel/currency
export async function updateCurrency(req, res) {
    const hotelId = resolveHotelId(req);
    if (!hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const { base, buy, sell } = req.body;
    const hotel = await prisma.hotel.update({
        where: { id: hotelId },
        data: {
            currency: base ?? undefined,
            fxBuy: buy ?? undefined,
            fxSell: sell ?? undefined,
        },
        select: { currency: true, fxBuy: true, fxSell: true },
    });
    res.json({
        base: hotel.currency,
        buy: Number(hotel.fxBuy || 0),
        sell: Number(hotel.fxSell || 0),
    });
}
export async function listRooms(req, res) {
    const hotelId = resolveHotelId(req);
    if (!hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const rooms = await prisma.room.findMany({ where: { hotelId }, orderBy: { number: "asc" } });
    res.json(rooms);
}
export async function listGuests(req, res) {
    const hotelId = resolveHotelId(req);
    if (!hotelId)
        return res.status(400).json({ message: "Hotel no definido en token" });
    const guests = await prisma.guest.findMany({
        where: { hotelId },
        orderBy: { createdAt: "desc" },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    res.json(guests);
}
