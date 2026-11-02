import { z } from "zod";

export const contactSchema = z.object({
  subject: z.string().trim().min(1, "Enter a subject").max(100),
  message: z.string().trim().min(1, "Enter a message").max(4000),
});
export const reportReplySchema = z.object({
  reportId: z.string().uuid(),
  reply: z.string().trim().min(1, "Write a reply first").max(4000),
  mediaUrl: z.string().max(2048).url().startsWith("https://").nullable(),
});