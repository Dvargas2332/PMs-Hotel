import { z } from "zod";
export const upsertRoomSchema = z.object({
body: z.object({ number: z.string().min(1), type: z.string().min(1), status: z.enum(["AVAILABLE","OCCUPIED","CLEANING","BLOCKED"]).optional(), notes: z.string().optional() })
});