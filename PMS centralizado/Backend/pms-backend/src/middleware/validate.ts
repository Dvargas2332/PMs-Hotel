// src/middleware/validate.ts

import type { AnyZodObject } from "zod";
import type { Request, Response, NextFunction } from "express";
export const validate = (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction) => {
const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
if (!result.success) {
  const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
  return res.status(400).json({ message: `Validación fallida: ${issues}`, errors: result.error.flatten() });
}
next();
};