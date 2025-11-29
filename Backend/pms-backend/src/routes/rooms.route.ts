import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { upsertRoomSchema } from "../schemas/rooms.schema.js";
import { listRooms, upsertRoom } from "../controllers/rooms.controller.js";


const r = Router();
r.get("/rooms", listRooms);
r.post("/rooms", validate(upsertRoomSchema), upsertRoom);
export default r;