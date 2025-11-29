import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { sign } from "../lib/jwt.js";


export async function register(req: Request, res: Response) {
const { email, name, password } = req.body;
const exists = await prisma.user.findUnique({ where: { email } });
if (exists) return res.status(409).json({ message: "Email ya registrado" });
const hash = await bcrypt.hash(password, 10);
const user = await prisma.user.create({ data: { email, name, password: hash } });
const token = sign({ sub: user.id, role: user.role });
res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}


export async function login(req: Request, res: Response) {
const { email, password } = req.body;
const user = await prisma.user.findUnique({ where: { email } });
if (!user) return res.status(401).json({ message: "Credenciales inválidas" });
const ok = await bcrypt.compare(password, user.password);
if (!ok) return res.status(401).json({ message: "Credenciales inválidas" });
const token = sign({ sub: user.id, role: user.role });
res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}