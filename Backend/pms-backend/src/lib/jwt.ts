import jwt from "jsonwebtoken";
import type { SignOptions, JwtPayload } from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "";
if (!SECRET) throw new Error("JWT_SECRET no está definido");

const DEFAULT_OPTIONS: SignOptions = {
  // jsonwebtoken acepta string | number aquí
  expiresIn: (process.env.JWT_EXPIRES ?? "7d") as any,
  algorithm: "HS256",
};

export function sign(payload: object, options?: SignOptions): string {
  return jwt.sign(payload as any, SECRET, { ...DEFAULT_OPTIONS, ...(options ?? {}) });
}

export function verify<T = JwtPayload>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}

export function decode(token: string) {
  return jwt.decode(token);
}
