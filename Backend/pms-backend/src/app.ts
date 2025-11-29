//copyright (c) 2025 by Diego Alonso Vargas Almengor
//all rights reserved
//src/app.ts



import express from "express";
import "dotenv/config";
import health from "./routes/health.route.js";
import auth from "./routes/auth.route.js";
import rooms from "./routes/rooms.route.js";
import reservations from "./routes/reservations.route.js";
import { logger } from "./lib/logger.js";

import guests from "./routes/guests.route.js";
import { auth } from "./middleware/auth.js"; // si necesitas usarlo a nivel global


const app = express();
app.use(express.json());


app.use(health);
app.use(auth);
app.use(rooms);
app.use(reservations);
app.use(guests);
app.use(auth)


app.use((err: any, _req: any, res: any, _next: any) => {
logger.error(err);
res.status(500).json({ message: "Internal Server Error" });
});


export default app;