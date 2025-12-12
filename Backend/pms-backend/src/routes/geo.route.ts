import { Router } from "express";
import { listCountries, listRegions, listCities } from "../controllers/geo.controller.js";

const router = Router();

router.get("/countries", listCountries);
router.get("/regions", listRegions);
router.get("/cities", listCities);

export default router;

