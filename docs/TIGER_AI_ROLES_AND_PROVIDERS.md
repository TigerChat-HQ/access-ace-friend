# TIGERCHAT AI Provider Agreement

This document records the provider boundaries for the AI features retained in TIGERCHAT.

## 1. Tiger AI — Home Page and in-app assistant

- Primary role: the general-purpose assistant for app users.
- Responsibilities: answer questions, guide users through TIGERCHAT, explain features, translate, summarize, and provide supported creative assistance.
- Text chat provider: Google Gemini 2.5 Flash-Lite through the Gemini API.
- Image and video generation remain on the existing Lovable AI Gateway integration.
- Never expose provider keys or secrets to the client.

## 2. Quiz AI

- Quiz generation uses Groq through the server-side `GROQ_API_KEY` and optional `GROQ_MODEL` configuration (default `openai/gpt-oss-20b`).
- Quiz generation is an independent user-facing feature; it does not depend on a Developer Assistant.
- Generate exactly 10 questions per batch in natural Swahili, with four distinct multiple-choice options (A-D), a correct answer index, category, difficulty, and factual explanation.
- Validate responses server-side, reject malformed or repeated batches, and keep question history scoped to the authenticated user.
- The endpoint is `supabase/functions/quiz-generate/index.ts`; preserve its structured-output validation and rate-limit handling.

## Cost, limits, and reliability

- Provider free tiers remain subject to current quotas, rate limits, and provider policies; they are not unlimited or guaranteed.
- Handle HTTP 429 with a clear retry-later message. Do not silently fall back to a paid OpenAI API.
- Keep provider keys in Supabase Edge Function secrets only: `GEMINI_API_KEY`, `GROQ_API_KEY`, and existing gateway secrets.
- Never commit API keys, access tokens, service-role keys, or other credentials.
- If a provider key is missing or invalid, return a clear server-side configuration error without exposing secret values.

## Verification

Before calling the AI setup production-ready, verify the intended secrets exist and run authenticated end-to-end tests for:
1. Home Page text chat with Gemini.
2. Quiz generation returning exactly 10 valid Swahili multiple-choice questions through Groq.
3. Missing-key, invalid-key, and rate-limit (429) handling.
4. Image/video generation through the existing Lovable AI Gateway integration.

This document describes intended provider boundaries; it is not a claim that live secrets or end-to-end tests have been verified.
