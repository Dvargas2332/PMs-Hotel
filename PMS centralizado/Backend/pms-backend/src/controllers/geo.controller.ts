import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

export async function listCountries(_req: Request, res: Response) {
  const countries = await prisma.country.findMany({
    orderBy: { name: "asc" },
  });
  res.json(countries);
}

export async function listRegions(req: Request, res: Response) {
  const { country } = req.query as { country?: string };
  if (!country) return res.status(400).json({ message: "country es requerido" });

  const codeOrName = String(country);
  const countryRow = await prisma.country.findFirst({
    where: {
      OR: [{ code: codeOrName }, { name: { equals: codeOrName, mode: "insensitive" } }],
    },
  });
  if (!countryRow) return res.json([]);

  const regions = await prisma.region.findMany({
    where: { countryCode: countryRow.code },
    orderBy: { name: "asc" },
  });
  res.json(regions);
}

export async function listCities(req: Request, res: Response) {
  const { country, regionId } = req.query as { country?: string; regionId?: string };
  if (!country) return res.status(400).json({ message: "country es requerido" });

  const codeOrName = String(country);
  const countryRow = await prisma.country.findFirst({
    where: {
      OR: [{ code: codeOrName }, { name: { equals: codeOrName, mode: "insensitive" } }],
    },
  });
  if (!countryRow) return res.json([]);

  const where: any = { countryCode: countryRow.code };
  if (regionId) where.regionId = String(regionId);

  const cities = await prisma.city.findMany({
    where,
    orderBy: { name: "asc" },
  });
  res.json(cities);
}

