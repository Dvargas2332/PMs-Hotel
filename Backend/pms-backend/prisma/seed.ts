// prisma/seed-user.ts

import { PrismaClient, Role, RoomStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // usuario admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@pms.local" },
    update: {},
    create: {
      email: "admin@pms.local",
      name: "Administrador",
      password: "$2b$10$gJxPqOC1kWmH4dT1rF0kQeN8b9D2QHRN4oQ36w2kLk3mRkZsC5y6e", // "Admin1234" (bcrypt)
      role: Role.ADMIN,
    },
  });

  // habitaciones
  const roomsData = [
    { number: "101", type: "STD", baseRate: 35000, status: RoomStatus.AVAILABLE },
    { number: "102", type: "STD", baseRate: 35000, status: RoomStatus.AVAILABLE },
    { number: "201", type: "DELUXE", baseRate: 50000, status: RoomStatus.AVAILABLE },
  ];
  for (const r of roomsData) {
    await prisma.room.upsert({
      where: { number: r.number },
      update: r,
      create: r,
    });
  }

  // huésped demo
  await prisma.guest.upsert({
    where: { email: "demo@guest.local" },
    update: {},
    create: { firstName: "Huésped", lastName: "Demo", email: "demo@guest.local", phone: "7000-0000" },
  });

  

  console.log("Seed listo:", { admin: admin.email });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
