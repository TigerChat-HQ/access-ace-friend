# TIGERCHAT AI Roles and Provider Agreement

This document records the agreed responsibility split for the AI features in TIGERCHAT.

## 1. Tiger AI — Home Page and in-app assistant

- Primary role: the general-purpose assistant for app users.
- Responsibilities: answer questions, guide users through TIGERCHAT, explain features, translate, summarize, and provide supported creative assistance.
- Text chat provider in the current implementation: Google Gemini 2.5 Flash-Lite through the Gemini API.
- Image and video generation currently remain on the existing Lovable AI Gateway integration; do not describe these paths as free or unlimited.
- Never expose provider keys or secrets to the client.

## 2. Tiger Developer Assistant — Admin / Developer Command Center

- Primary role: technical co-developer for TIGERCHAT.
- Responsibilities: inspect repository code, diagnose bugs, prepare implementation plans, propose code changes, and report GitHub check status.
- Current text provider/model in the Edge Function: Groq, using GROQ_MODEL or the default openai/gpt-oss-20b.
- GitHub write operations require the server-side GITHUB_TOKEN and must remain protected by the existing server-side admin role checks.
- Proposed code changes must remain reviewable; do not claim a draft pull request is merged or deployed.

## 3. Quiz question generation

- The Quiz must use the same AI provider/model family and credentials as Tiger Developer Assistant: Groq via GROQ_API_KEY and GROQ_MODEL (default openai/gpt-oss-20b).
- Quiz generation is a dedicated server-side task using the Developer Assistant's question-writing role, not a separate paid OpenAI integration.
- Generate exactly 10 questions per batch, in natural Swahili, with four distinct multiple-choice options (A-D), a correct answer index, category, difficulty, and a factual explanation.
- Validate the response server-side, reject malformed or repeated batches, and keep question history scoped to the authenticated user.
- The existing quiz endpoint is supabase/functions/quiz-generate/index.ts. It currently calls Groq directly with the same Groq configuration/model as tiger-dev-planner; preserve the Quiz-specific structured output validation.

## Cost, limits, and reliability

- "Free tier" means subject to the provider's current quotas, rate limits, and policy; it does not mean unlimited usage or guaranteed uptime.
- Handle HTTP 429 with a clear retry-later message. Do not silently fall back to a paid OpenAI API.
- Keep provider keys in Supabase Edge Function secrets only: GEMINI_API_KEY, GROQ_API_KEY, and any existing gateway secrets.
- Never commit API keys, access tokens, service-role keys, or other credentials.
- If a provider key is missing or invalid, return a clear server-side configuration error without exposing secret values.

## Current implementation map

- Home assistant: supabase/functions/tiger-ai/index.ts
- Developer assistant / command center: supabase/functions/tiger-dev-planner/index.ts and src/components/admin/TigerCommandCenter.tsx
- Quiz generation: supabase/functions/quiz-generate/index.ts and src/pages/Game.tsx

## Verification still required

Before calling the AI setup production-ready, verify the corresponding secrets exist in the intended Supabase project and run authenticated end-to-end tests for:
1. Home Page text chat with Gemini.
2. Developer Assistant Groq response and admin-only code-change workflow.
3. Quiz generation returning exactly 10 valid Swahili multiple-choice questions.
4. Missing-key, invalid-key, and rate-limit (429) handling.
5. Confirm no user-facing AI text path unexpectedly calls a paid OpenAI API.

This document records the agreed architecture and current code paths. It is not a claim that provider secrets or live end-to-end tests have been verified.
