import { Router } from "express";
import { submitFormInfo } from "../controllers/forminfo.controller.js";

const router = Router();

function requireFormInfoKey(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const expected = String(process.env.FORMINFO_API_KEY || "").trim();
  if (!expected) {
    return res.status(500).json({ message: "FORMINFO_API_KEY not configured" });
  }
  const key = String(req.headers["x-forminfo-key"] || req.query.key || "").trim();
  if (!key || key !== expected) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

async function verifyTurnstile(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    return res.status(500).json({ message: "TURNSTILE_SECRET_KEY not configured" });
  }

  const token =
    String(req.body?.captchaToken || req.body?.["cf-turnstile-response"] || req.body?.turnstileToken || "").trim();
  if (!token) {
    return res.status(400).json({ message: "Captcha token is required" });
  }

  try {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", token);
    const remoteIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    if (remoteIp) params.set("remoteip", remoteIp);

    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await resp.json()) as { success?: boolean };
    if (!data?.success) {
      return res.status(403).json({ message: "Captcha verification failed" });
    }
    return next();
  } catch {
    return res.status(502).json({ message: "Captcha verification failed" });
  }
}

// Public endpoint for marketing forms
router.post("/", requireFormInfoKey, submitFormInfo);
router.post("/public", verifyTurnstile, submitFormInfo);

export default router;
