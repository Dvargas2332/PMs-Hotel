// src/middleware/auth.ts

import type { Request, Response, NextFunction } from "express";
import { verify } from "../lib/jwt.js";


export interface AuthUser { sub: string; role: "ADMIN"|"MANAGER"|"RECEPTION" }


export function auth(req: Request, res: Response, next: NextFunction) {
const hdr = req.headers.authorization || "";
const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
if (!token) return res.status(401).json({ message: "No token" });
try {
const payload = verify<AuthUser>(token);
// @ts-ignore
req.user = payload;
next();
} catch {
return res.status(401).json({ message: "Token inválido" });
}
}


export function requireRole(...roles: AuthUser["role"][]) {
return (req: Request, res: Response, next: NextFunction) => {
// @ts-ignore
const user = req.user as AuthUser | undefined;
if (!user) return res.status(401).json({ message: "No autenticado" });
if (!roles.includes(user.role)) return res.status(403).json({ message: "No autorizado" });
next();
};
}