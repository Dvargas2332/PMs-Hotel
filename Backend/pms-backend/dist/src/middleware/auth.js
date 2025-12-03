// src/middleware/auth.ts
import { verify } from "../lib/jwt.js";
export function auth(req, res, next) {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token)
        return res.status(401).json({ message: "No token" });
    try {
        const payload = verify(token);
        // @ts-ignore
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ message: "Token inválido" });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
        // @ts-ignore
        const user = req.user;
        if (!user)
            return res.status(401).json({ message: "No autenticado" });
        if (!roles.includes(user.role))
            return res.status(403).json({ message: "No autorizado" });
        next();
    };
}
