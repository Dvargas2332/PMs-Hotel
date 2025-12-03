// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
export default prisma;
console.log("[DB] DATABASE_URL:", process.env.DATABASE_URL);
process.on("beforeExit", async () => {
    await prisma.$disconnect();
});
