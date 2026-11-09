# Calling hardening rollout

This branch intentionally does not deploy changes to production.

## TURN relay setup (required before real-call testing)

The app requests short-lived TURN credentials from the authenticated `turn-credentials` Edge Function. The function signs a coturn REST API username using HMAC-SHA1; it never returns the shared secret to the browser.

Configure these Edge Function secrets only after a TURN provider has been selected and configured for coturn REST authentication:

- `TURN_SHARED_SECRET`: at least 32 random bytes, identical to coturn's `static-auth-secret`.
- `TURN_URLS`: comma- or whitespace-separated `turn:` / `turns:` URLs, including the correct port and transport.
- `TURN_CREDENTIAL_TTL_SECONDS`: optional; defaults to 600 and is clamped to 300–3600 seconds.

Do not use demo TURN credentials or place the shared secret in Vite environment variables.

## Push notification path

Call push notifications use the existing authenticated `dispatch-push` function and Firebase Messaging device tokens. Required configuration is already referenced by that function:

- Edge Function secrets: `LOVABLE_API_KEY`, `FIREBASE_MESSAGING_API_KEY`.
- Frontend Firebase Messaging connection values: `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID`, `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY`, `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY`, `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID`.

Users must grant notification permission and register a device token. The call offer remains the source of truth; push is best-effort and does not itself accept a call.

## Required database hardening before release

The current production RLS policy snapshot permits participant inserts using only caller/callee identity, and has participant-wide UPDATE/DELETE policies. Before release, replace these with an INSERT policy that verifies:

1. `auth.uid()` is exactly the sender in `signal_data.from`.
2. Caller and callee are distinct users and both belong to the same `conversation_members` row set for the supplied `conversation_id`.
3. `call_type` is `voice` or `video`.
4. `signal_type` is allow-listed and role-appropriate (`offer` only by caller; `answer`/`reject` only by callee; ICE candidates and hangup by either participant).
5. `status` is allow-listed.

Remove client UPDATE and DELETE policies/grants; the current client protocol only inserts immutable signal events. Preserve participant-only SELECT for Realtime.

This SQL change must be applied and tested on an isolated Supabase development branch before production. It is deliberately not applied to the live project by this code-only branch.

## Test gates

- GitHub CI build, typecheck, lint and tests pass.
- Two authenticated test accounts in the same conversation can complete voice and video calls.
- Test direct peer and TURN-relayed ICE paths, including restrictive mobile networks.
- Confirm push notification arrives when the callee app is backgrounded/closed and opens the correct chat.
- Confirm no call UI claims end-to-end encryption.
- Confirm unauthenticated users cannot obtain TURN credentials and unrelated users cannot signal into a conversation.
