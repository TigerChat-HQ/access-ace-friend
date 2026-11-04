# Independent TIGERCHATS deployment

TIGERCHATS is being separated from Lovable. The frontend is a Vite/React application; Supabase provides database, authentication, storage and Edge Functions; GitHub remains the source repository.

## Single AI provider decision

Use **OpenAI only**, with **gpt-6.1-sol** as the single text/reasoning model for Tiger AI, translation, summaries, smart replies, recommendations and development planning. Do not configure a second paid text-model provider or automatic model fallback. Keep the OpenAI key server-side as the Supabase Edge Function secret `OPENAI_API_KEY`. Do not expose it through a `VITE_*` variable or commit it to GitHub.

Image generation, if retained, must use an OpenAI image-generation endpoint from a server-side Edge Function. It is a modality-specific image model from the same provider, not a second conversational AI provider. Video generation must not silently keep using Lovable; only restore it after a supported direct provider workflow is implemented and tested.

## Frontend environment

Set these build-time variables in the hosting provider and in `.env.local` for local development:

- `VITE_SUPABASE_URL`: URL of the destination Supabase project.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key for that same project.

Never put a Supabase service-role key, OpenAI API key, GitHub token, or other server secret in a `VITE_*` variable.

## Build and test

```sh
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

## Hosting

Connect this GitHub repository to an independent static hosting provider such as Vercel or Cloudflare Pages. Use the repository's actual build script and output directory after CI verification. Configure SPA fallback and the two frontend variables above.

## Supabase and release gates

Back up and verify schema, Auth, Storage and RLS before applying migrations. Configure `OPENAI_API_KEY` as a Supabase Edge Function secret. Deploy Edge Functions only after local checks pass. Keep the existing project and production branch unchanged until login, chat, posts, media, notifications and access policies pass staging tests.

## Remaining work

Tiger AI chat, admin image generation and developer editing/planning/recommendations now call OpenAI/GitHub directly on this branch. Video generation is temporarily disabled rather than left on Lovable. Regenerate the Bun lockfile using Bun; run CI/build/tests; configure hosting and secrets; migrate and verify source project data. The migration is not complete until all these release gates pass.
