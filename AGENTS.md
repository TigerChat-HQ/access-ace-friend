# Project rules
- Status replies use a security-invoker RPC and snapshot context in direct messages; status visibility and chat membership remain enforced by RLS.
- Authenticator MFA gates signed-in navigation; biometric verification is a synchronized local device lock, never account authorization.
- Firebase push uses a dedicated messaging worker and authenticated server dispatch; device tokens are private to their owner.
- Fresh quizzes are generated server-side with validated answers and per-user served-question history; AI does not write the shared admin question bank.
- Contact reuses reports through authenticated validation RPCs; report replies and notifications are committed atomically to avoid missing user alerts.
- Public draughts practice uses the shared engine without exposing private multiplayer data; sitemap generation lists only public content routes.
- Draughts legal moves are computed in the shared engine for both human and AI players; flying kings share capture-chain logic so both modes follow identical rules.
- Tiger AI identity context is conversational only and must never be used for account authorization.
- Call media is owned by the global call provider, while the call dialog attaches playback elements; keeping ownership separate prevents navigation from terminating calls.- Tiger AI code changes go through GitHub as draft pull requests for human review; it never merges or publishes on its own, so every code change stays reviewable and reversible.
