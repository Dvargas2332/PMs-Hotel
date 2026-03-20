// src/routes/auth.route.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { login, register } from "../controllers/auth.controller.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "auth-login" });

// Rutas relativas (no incluyas /auth aqui)
router.post("/register", validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);

// Login de usuarios Front Desk / Management (misma lógica que /login sobre la tabla User)
router.post("/user-login", loginLimiter, validate(loginSchema), login);

export default router;
