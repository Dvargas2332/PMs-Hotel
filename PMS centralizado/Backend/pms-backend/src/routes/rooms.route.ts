// src/routes/rooms.route.ts
import { Router } from "express";
import { auth, requirePermission, requireManagementUser } from "../middleware/auth.js";
import { listRooms, upsertRoom, archiveRoom, updateRoomStatus } from "../controllers/rooms.controller.js";

const router = Router();

// Prefijo /api/rooms lo monta app.ts; auth viene antes en la cadena.
router.get("/", auth, requirePermission("frontdesk.read"), listRooms); // GET /api/rooms
router.post("/", auth, requireManagementUser, requirePermission("management.settings.write"), upsertRoom); // POST /api/rooms
router.patch("/:id/status", auth, requirePermission("frontdesk.write"), updateRoomStatus); // PATCH /api/rooms/:id/status
router.delete("/:id", auth, requireManagementUser, requirePermission("management.settings.write"), archiveRoom); // DELETE /api/rooms/:id

export default router;
