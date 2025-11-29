import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { login, register } from "../controllers/auth.controller.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";


const r = Router();
r.post("/auth/register", validate(registerSchema), register);
r.post("/auth/login", validate(loginSchema), login);
export default r;