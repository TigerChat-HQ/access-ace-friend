# Independent TIGERCHATS deployment

The frontend is a Vite/React application and can be hosted independently of Lovable. Supabase remains the backend.

## Frontend environment

Set these build-time variables in the hosting provider and in `.env.local` for local development:

- `VITE_SUPABASE_URL`: URL of the destination Supabase project.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key for that same project.

Never place a Supabase service-role key, Google AI key, GitHub token, or other server secret in a `VITE_*` variable; Vite exposes these values in browser code.

## Build and test

```sh
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

## Hosting

Connect this GitHub repository to a static hosting provider such as Vercel or Cloudflare Pages. Use `bun run build` and output directory `dist`. Configure an SPA fallback/rewrite to `/index.html`, and set the two frontend variables above.

## Supabase

The Supabase project is configured separately. Back up and verify schema, Auth, Storage, and RLS before applying migrations or deploying Edge Functions. Edge Function secrets belong in Supabase project secrets, never in source files.

## Remaining work before complete Lovable removal

Several Edge Functions still depend on Lovable AI Gateway or Lovable's GitHub connector. These need to be replaced with direct provider APIs and tested. Image/video generation needs compatible Google API models and should not be silently disabled. The dependency lockfile also needs regeneration after removing Lovable-only npm packages.
