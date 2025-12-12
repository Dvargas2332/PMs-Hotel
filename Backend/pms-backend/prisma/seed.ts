// prisma/seed.ts

import { PrismaClient, Role, RoomStatus } from "@prisma/client";
import { ALL_PERMISSIONS } from "../src/config/permissions.js";

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
    update: {
      // ensure default admin stays usable if seed runs multiple times
      name: "Administrador",
      password: "$2b$10$VGzA6g6enxYQvOJDikAINuvGZ9DTnb7KxAeVGCCCs8igOhFvPyq5i", // "Admin1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
    create: {
      email: "admin@pms.local",
      name: "Administrador",
      password: "$2b$10$VGzA6g6enxYQvOJDikAINuvGZ9DTnb7KxAeVGCCCs8igOhFvPyq5i", // "Admin1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
  });

  // permisos base
  for (const p of ALL_PERMISSIONS) {
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
    data: ALL_PERMISSIONS.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: hotel.id })),
    skipDuplicates: true,
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

  // ===== Catálogo geográfico básico (paises / regiones / ciudades) =====
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "data", "world-geo.sample.json");
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const json = JSON.parse(raw) as {
        countries?: { code: string; name: string; regions?: { code?: string; name: string; cities?: string[] }[] }[];
      };
      for (const c of json.countries || []) {
        const country = await prisma.country.upsert({
          where: { code: c.code },
          update: { name: c.name },
          create: { code: c.code, name: c.name },
        });
        for (const r of c.regions || []) {
          const regionId = `${country.code}-${r.code || r.name}`;
          const region = await prisma.region.upsert({
            where: { id: regionId },
            update: { name: r.name, code: r.code || null },
            create: { id: regionId, name: r.name, code: r.code || null, countryCode: country.code },
          });
          for (const cityName of r.cities || []) {
            await prisma.city.upsert({
              where: {
                // combinamos nombre + pais para evitar duplicados simples
                id: `${country.code}-${region.id}-${cityName}`,
              },
              update: { name: cityName },
              create: {
                id: `${country.code}-${region.id}-${cityName}`,
                name: cityName,
                countryCode: country.code,
                regionId: region.id,
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("No se pudo cargar catalogo geografico:", err);
  }

  console.log("Seed listo:", { hotel: hotel.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
