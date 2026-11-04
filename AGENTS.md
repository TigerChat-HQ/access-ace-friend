# Project rules
- Contact reuses reports through authenticated validation RPCs; report replies and notifications are committed atomically to avoid missing user alerts.
- Public draughts practice uses the shared engine without exposing private multiplayer data; sitemap generation lists only public content routes.
- Draughts legal moves are computed in the shared engine for both human and AI players; flying kings share capture-chain logic so both modes follow identical rules.
- Tiger AI identity context is conversational only and must never be used for account authorization.
- Call media is owned by the global call provider, while the call dialog attaches playback elements; keeping ownership separate prevents navigation from terminating calls.
- Signup ownership uses a durable singleton claim inside the signup transaction; deleting the owner cannot grant ownership to a later signup.
- Dama writes go through authenticated RPCs and server-validated moves with revision checks; the server engine mirrors the shared client engine and must remain identical.
- Tiger editor is restricted to one repository and non-sensitive source paths; approved tasks create audited proposals and draft review branches, never merge or publish automatically.