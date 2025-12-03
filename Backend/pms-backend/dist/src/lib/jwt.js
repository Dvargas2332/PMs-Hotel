import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET ?? "";
if (!SECRET)
    throw new Error("JWT_SECRET no está definido");
const DEFAULT_OPTIONS = {
    // jsonwebtoken acepta string | number aquí
    expiresIn: (process.env.JWT_EXPIRES ?? "7d"),
    algorithm: "HS256",
};
export function sign(payload, options) {
    return jwt.sign(payload, SECRET, { ...DEFAULT_OPTIONS, ...(options ?? {}) });
}
export function verify(token) {
    return jwt.verify(token, SECRET);
}
export function decode(token) {
    return jwt.decode(token);
}
