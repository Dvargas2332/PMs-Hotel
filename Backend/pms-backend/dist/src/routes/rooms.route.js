// src/routes/rooms.route.ts
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { listRooms, upsertRoom } from "../controllers/rooms.controller.js";
const router = Router();
// Prefijo /api/rooms lo monta app.ts; auth viene antes en la cadena.
router.get("/", auth, listRooms); // GET /api/rooms
router.post("/", auth, upsertRoom); // POST /api/rooms
export default router;
