// prisma/seed.ts
import { PrismaClient, Role, RoomStatus } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    // usuario y hotel demo
    const hotel = await prisma.hotel.upsert({
        where: { id: "hotel-demo" },
        update: {},
        create: { id: "hotel-demo", name: "Hotel Demo", currency: "CRC" },
    });
    await prisma.user.upsert({
        where: { email: "admin@pms.local" },
        update: {},
        create: {
            email: "admin@pms.local",
            name: "Administrador",
            password: "$2b$10$gJxPqOC1kWmH4dT1rF0kQeN8b9D2QHRN4oQ36w2kLk3mRkZsC5y6e", // "Admin1234"
            role: Role.ADMIN,
            hotelId: hotel.id,
        },
    });
    // permisos base
    const basePerms = [
        "frontdesk.read",
        "frontdesk.create_reservation",
        "frontdesk.checkin",
        "frontdesk.checkout",
        "accounting.read",
        "management.settings.write",
        "restaurant.pos.open",
    ];
    for (const p of basePerms) {
        await prisma.permission.upsert({
            where: { id: p },
            update: {},
            create: { id: p, description: p },
        });
    }
    // rol admin para hotel
    await prisma.appRole.upsert({
        where: { hotelId_id: { hotelId: hotel.id, id: "ADMIN" } },
        update: { name: "ADMIN", description: "Administrador" },
        create: { id: "ADMIN", name: "ADMIN", description: "Administrador", hotelId: hotel.id },
    });
    // asignar permisos al admin
    await prisma.rolePermission.deleteMany({ where: { hotelId: hotel.id, roleId: "ADMIN" } });
    await prisma.rolePermission.createMany({
        data: basePerms.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: hotel.id })),
    });
    // habitaciones
    const roomsData = [
        { number: "101", type: "STD", baseRate: 35000, status: RoomStatus.AVAILABLE, hotelId: hotel.id },
        { number: "102", type: "STD", baseRate: 35000, status: RoomStatus.AVAILABLE, hotelId: hotel.id },
        { number: "201", type: "DELUXE", baseRate: 50000, status: RoomStatus.AVAILABLE, hotelId: hotel.id },
    ];
    for (const r of roomsData) {
        await prisma.room.upsert({
            where: { hotelId_number: { hotelId: hotel.id, number: r.number } },
            update: r,
            create: r,
        });
    }
    // huesped demo
    await prisma.guest.upsert({
        where: { hotelId_email: { hotelId: hotel.id, email: "demo@guest.local" } },
        update: {},
        create: { firstName: "Huesped", lastName: "Demo", email: "demo@guest.local", phone: "7000-0000", hotelId: hotel.id },
    });
    console.log("Seed listo:", { hotel: hotel.id });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => prisma.$disconnect());
