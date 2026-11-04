# TIGERCHAT

TIGERCHAT is a React + Vite application using Supabase for authentication, database access, and Edge Functions.

## Current backend

- Supabase project: `dngilyoyhmgazhuuaxfh`
- Supabase region: `eu-central-1`
- Frontend Supabase configuration: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Edge Functions are maintained in `supabase/functions/`

## Development

Requirements: Bun (recommended) or Node.js.

```sh
git clone https://github.com/TigerChat-HQ/access-ace-friend.git
cd access-ace-friend
bun install
bun run dev
```

## Verification

```sh
bun run lint
bun run test
bun run build
```

## Supabase deployment

The Supabase project is managed independently from the frontend hosting. Database migrations are in `supabase/migrations/`; Edge Functions are in `supabase/functions/`.

The GitHub Actions workflow `.github/workflows/deploy-supabase.yml` deploys migrations and functions when the repository has a `SUPABASE_ACCESS_TOKEN` Actions secret configured. If that secret is not available, the workflow deliberately skips CLI deployment rather than failing. Do not put service-role keys or private API keys in frontend variables.

## Frontend hosting

A production frontend hosting target has not yet been configured in this repository. The Vite production build is generated with `bun run build` in `dist/`.
