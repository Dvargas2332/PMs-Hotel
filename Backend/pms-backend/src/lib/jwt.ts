import jwt from "jsonwebtoken";
const secret = process.env.JWT_SECRET as string;
export function sign(payload: object, options: jwt.SignOptions = { expiresIn: process.env.JWT_EXPIRES || "7d" }) {
return jwt.sign(payload, secret, options);
}
export function verify<T = any>(token: string) {
return jwt.verify(token, secret) as T;
}