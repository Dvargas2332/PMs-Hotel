import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { auth } from "../middleware/auth.js";
import { createGuest, listGuests, updateGuest } from "../controllers/guests.controller.js";
import { createGuestSchema, updateGuestSchema } from "../schemas/guests.schema.js";


const r = Router();
r.get("/guests", auth, listGuests);
r.post("/guests", auth, validate(createGuestSchema), createGuest);
r.put("/guests/:id", auth, validate(updateGuestSchema), updateGuest);
export default r;