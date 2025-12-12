// src/routes/roomTypes.route.ts
import { Router } from "express";
import { auth, requirePermission } from "../middleware/auth.js";
import { listRoomTypes, createRoomType, updateRoomType, deleteRoomType } from "../controllers/roomTypes.controller.js";

const router = Router();

// Prefijo /api/roomTypes lo monta app.ts; auth viene antes en la cadena.
router.get("/", auth, requirePermission("frontdesk.read"), listRoomTypes); // GET /api/roomTypes
router.post("/", auth, requirePermission("management.settings.write"), createRoomType); // POST /api/roomTypes
router.put("/:id", auth, requirePermission("management.settings.write"), updateRoomType); // PUT /api/roomTypes/:id
router.delete("/:id", auth, requirePermission("management.settings.write"), deleteRoomType); // DELETE /api/roomTypes/:id

export default router;

