import { z } from "npm:zod@4";
export const quizSchema = z.object({ questions: z.array(z.object({ category: z.string().min(1), difficulty: z.enum(["easy", "medium", "hard"]), question: z.string().min(10).max(500), options: z.array(z.string().min(1).max(200)).length(4), correct_index: z.number().int().min(0).max(3), explanation: z.string().min(5).max(1000) })).length(10) });
export const normalizeQuestion = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export function isFreshBatch(questions: { question: string }[], previous: string[]) {
  const seen = new Set(previous.map(normalizeQuestion));
  for (const question of questions) {
    const key = normalizeQuestion(question.question);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}