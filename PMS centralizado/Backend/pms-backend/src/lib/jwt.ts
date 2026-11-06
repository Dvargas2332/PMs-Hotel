import "dotenv/config";
import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "";
if (!SECRET) {
  throw new Error(
    'JWT_SECRET no está definido. Configúralo como variable de entorno (Elastic Beanstalk -> Environment properties) o crea un archivo ".env" (puedes copiar ".env.example").'
  );
}

const ACCESS_EXPIRES = (process.env.JWT_ACCESS_EXPIRES ?? "15m") as any;
const REFRESH_EXPIRES = (process.env.JWT_REFRESH_EXPIRES ?? "7d") as any;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${SECRET}:refresh`;

export function sign(payload: object, options?: SignOptions): string {
  return jwt.sign(payload as any, SECRET, {
    expiresIn: ACCESS_EXPIRES,
    algorithm: "HS256",
    ...(options ?? {}),
  });
}

export function signRefresh(payload: object): string {
  return jwt.sign(
    { ...(payload as any), type: "refresh" },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES, algorithm: "HS256" }
  );
}

export function verify<T = JwtPayload>(token: string): T {
  return jwt.verify(token, SECRET) as T;
}

export function verifyRefresh<T = JwtPayload>(token: string): T {
  const payload = jwt.verify(token, REFRESH_SECRET) as any;
  if (payload.type !== "refresh") throw new Error("Token is not a refresh token");
  return payload as T;
}

export function decode(token: string) {
  return jwt.decode(token);
}

export function getAccessCookieOpts(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("strict" as const) : ("lax" as const),
    path: "/",
    maxAge: 15 * 60 * 1000, // 15 min
  };
}

export function getRefreshCookieOpts(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("strict" as const) : ("lax" as const),
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

