// src/routes/auth.route.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  login,
  register,
  refresh,
  logout,
  getInvite,
  acceptInvite,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "../schemas/auth.schema.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "auth-login" });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "auth-register" });
const refreshLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: "auth-refresh" });
const inviteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "auth-invite" });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: "auth-forgot" });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "auth-reset" });

// Rutas relativas (no incluyas /auth aqui)
router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);

// Login de usuarios Front Desk / Management (misma lógica que /login sobre la tabla User)
router.post("/user-login", loginLimiter, validate(loginSchema), login);

// Refresh token
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);

// Recuperación de contraseña (públicas, sin sesión)
router.post("/forgot-password", forgotLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", resetLimiter, validate(resetPasswordSchema), resetPassword);

// Invitación del usuario principal (públicas, sin sesión)
router.get("/invite/:token", inviteLimiter, getInvite);
router.post("/accept-invite", inviteLimiter, acceptInvite);

export default router;
