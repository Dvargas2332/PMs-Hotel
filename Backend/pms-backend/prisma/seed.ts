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
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
    create: {
      email: "admin@pms.local",
      name: "Administrador",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
  });

  // Super usuario adicional para acceso completo al hotel demo
  await prisma.user.upsert({
    where: { email: "superadmin@pms.local" },
    update: {
      name: "Super Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
    create: {
      email: "superadmin@pms.local",
      name: "Super Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
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

  // Roles predefinidos para el hotel demo
  const predefinedRoles = [
    { id: "ADMIN", name: "Admin", description: "Administrador" },
    { id: "RECEPTION", name: "Recepción", description: "Recepción / Front Desk" },
    { id: "ACCOUNTING", name: "Contabilidad", description: "Contabilidad / Finanzas" },
    { id: "RESTAURANT", name: "Restaurante", description: "Operaciones de restaurante" },
    { id: "EINVOICING", name: "Facturación electrónica", description: "Facturación electrónica" },
  ] as const;

  for (const r of predefinedRoles) {
    await prisma.appRole.upsert({
      where: { hotelId_id: { hotelId: hotel.id, id: r.id } },
      update: { name: r.name, description: r.description },
      create: { id: r.id, name: r.name, description: r.description, hotelId: hotel.id },
    });
  }

  // Asignar permisos a cada rol (todos los permisos para ADMIN, módulos específicos para otros roles)
  await prisma.rolePermission.deleteMany({ where: { hotelId: hotel.id } });

  // Admin: todos los permisos
  await prisma.rolePermission.createMany({
    data: ALL_PERMISSIONS.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: hotel.id })),
    skipDuplicates: true,
  });

  // Cuenta de launcher admin por defecto para el hotel demo
  await prisma.launcherAccount.upsert({
    where: { hotelId_username: { hotelId: hotel.id, username: "admin" } },
    update: {
      name: "Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      roleId: "ADMIN",
    },
    create: {
      username: "admin",
      name: "Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      hotelId: hotel.id,
      roleId: "ADMIN",
    },
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

  // ===== Restaurante (config + salones/mesas + menu demo) =====
  await prisma.restaurantConfig.upsert({
    where: { hotelId: hotel.id },
    update: {
      kitchenPrinter: "REST_KITCHEN",
      barPrinter: "REST_BAR",
      taxes: { iva: 13, servicio: 10, descuentoMax: 15, permitirDescuentos: true, impuestoIncluido: true } as any,
      payments: { monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530, cobros: ["Efectivo", "Tarjeta", "SINPE", "Transferencia"], cargoHabitacion: true } as any,
      general: { nombreComercial: "Rest Demo", telefono: "+506 0000 0000", email: "rest@demo.com" } as any,
      billing: { comprobante: "factura", margen: "0", propina: "10", autoFactura: true } as any,
    },
    create: {
      hotelId: hotel.id,
      kitchenPrinter: "REST_KITCHEN",
      barPrinter: "REST_BAR",
      taxes: { iva: 13, servicio: 10, descuentoMax: 15, permitirDescuentos: true, impuestoIncluido: true } as any,
      payments: { monedaBase: "CRC", monedaSec: "USD", tipoCambio: 530, cobros: ["Efectivo", "Tarjeta", "SINPE", "Transferencia"], cargoHabitacion: true } as any,
      general: { nombreComercial: "Rest Demo", telefono: "+506 0000 0000", email: "rest@demo.com" } as any,
      billing: { comprobante: "factura", margen: "0", propina: "10", autoFactura: true } as any,
    },
  });

  const restSections = [
    {
      id: `${hotel.id}:sec-salon`,
      name: "Salon Principal",
      tables: [
        { id: `${hotel.id}:S01`, name: "Salon 1", seats: 4, x: 20, y: 40 },
        { id: `${hotel.id}:S02`, name: "Salon 2", seats: 2, x: 50, y: 35 },
        { id: `${hotel.id}:S03`, name: "Salon 3", seats: 4, x: 80, y: 45 },
      ],
    },
    {
      id: `${hotel.id}:sec-terraza`,
      name: "Terraza",
      tables: [
        { id: `${hotel.id}:T01`, name: "Terraza 1", seats: 4, x: 30, y: 50 },
        { id: `${hotel.id}:T02`, name: "Terraza 2", seats: 6, x: 70, y: 55 },
      ],
    },
    {
      id: `${hotel.id}:sec-barra`,
      name: "Barra",
      tables: [
        { id: `${hotel.id}:B01`, name: "Barra 1", seats: 2, x: 40, y: 60 },
        { id: `${hotel.id}:B02`, name: "Barra 2", seats: 2, x: 60, y: 65 },
      ],
    },
  ];

  for (const sec of restSections) {
    await prisma.restaurantSection.upsert({
      where: { id: sec.id },
      update: { name: sec.name, hotelId: hotel.id },
      create: { id: sec.id, name: sec.name, hotelId: hotel.id },
    });
    for (const t of sec.tables) {
      await prisma.restaurantTable.upsert({
        where: { id: t.id },
        update: { name: t.name, seats: t.seats, x: t.x as any, y: t.y as any, sectionId: sec.id },
        create: { id: t.id, name: t.name, seats: t.seats, x: t.x as any, y: t.y as any, sectionId: sec.id },
      });
    }
  }

  const hasMenu = await prisma.restaurantMenuItem.findFirst({ where: { hotelId: hotel.id }, select: { id: true } });
  if (!hasMenu) {
    const menuSeed = [
      { sectionId: `${hotel.id}:sec-salon`, name: "Nachos", price: 8, category: "Entradas" },
      { sectionId: `${hotel.id}:sec-salon`, name: "Hamburguesa", price: 11, category: "Platos" },
      { sectionId: `${hotel.id}:sec-salon`, name: "Refresco", price: 3, category: "Bebidas" },
      { sectionId: `${hotel.id}:sec-terraza`, name: "Ceviche", price: 9, category: "Entradas" },
      { sectionId: `${hotel.id}:sec-terraza`, name: "Pasta Alfredo", price: 12, category: "Platos" },
      { sectionId: `${hotel.id}:sec-barra`, name: "Cerveza", price: 4, category: "Bebidas" },
    ];
    await prisma.restaurantMenuItem.createMany({
      data: menuSeed.map((m) => ({ ...m, hotelId: hotel.id })),
    });
  }

  // ===== Catálogo geográfico básico (paises / regiones / ciudades) =====
  try {
    const fs = await import("fs");
    const fileUrl = new URL("./data/world-geo.sample.json", import.meta.url);
    if (fs.existsSync(fileUrl)) {
      const raw = fs.readFileSync(fileUrl, "utf-8");
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
