import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();


async function main() {
await prisma.user.upsert({
where: { email: "admin@pms.local" },
update: {},
create: {
email: "admin@pms.local",
name: "Admin",
password: "$2b$10$1f5k8Qv7Q2v3Kxg7sZ1d0u6q3z7r8x9y0a1b2c3d4e5f6g7h8i9jK", // bcrypt hash placeholder
role: "ADMIN",
},
});


await prisma.room.createMany({
data: [
{ number: "101", type: "Suite" },
{ number: "102", type: "Villa" },
{ number: "103", type: "Doble" },
{ number: "104", type: "Suite" }
],
skipDuplicates: true
});
}


main().finally(async () => prisma.$disconnect());