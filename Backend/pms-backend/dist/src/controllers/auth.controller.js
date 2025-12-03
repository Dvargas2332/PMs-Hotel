import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { sign } from "../lib/jwt.js";
const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
export async function register(req, res) {
    try {
        const { name, email, password, hotelName } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: "Email y password son requeridos" });
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(409).json({ message: "El email ya esta registrado" });
        // Crea hotel (uno por tenant) y asocia al usuario admin
        const hotel = await prisma.hotel.create({
            data: { name: hotelName || "Hotel Demo", currency: "CRC" },
            select: { id: true, name: true },
        });
        const hash = await bcrypt.hash(password, ROUNDS);
        const user = await prisma.user.create({
            data: {
                name: name ?? "Usuario",
                email,
                password: hash,
                role: "ADMIN",
                hotelId: hotel.id,
            },
            select: { id: true, name: true, email: true, role: true, createdAt: true, hotelId: true },
        });
        const token = sign({ sub: user.id, email: user.email, role: user.role, hotelId: user.hotelId });
        return res.status(201).json({ user, token, hotel });
    }
    catch (err) {
        if (err?.code === "P2002") {
            return res.status(409).json({ message: "El email ya esta registrado" });
        }
        console.error("[auth.register] error:", err);
        return res.status(500).json({ message: "No se pudo registrar" });
    }
}
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: "Email y password son requeridos" });
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ message: "Credenciales invalidas" });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok)
            return res.status(401).json({ message: "Credenciales invalidas" });
        const token = sign({ sub: user.id, email: user.email, role: user.role, hotelId: user.hotelId });
        return res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, hotelId: user.hotelId },
        });
    }
    catch (err) {
        console.error("[auth.login] error:", err);
        return res.status(500).json({ message: "No se pudo iniciar sesion" });
    }
}
