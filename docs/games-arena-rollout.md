# TigerChat Games Arena rollout checklist

Pool Game has been retired. The active Games Hub contains Draughts Arena and Tiger Quiz Arena.

## Games Hub
- [x] Responsive Games Hub at `/games`.
- [x] Draughts Arena entry point.
- [x] Tiger Quiz Arena entry point.
- [x] Main app navigation opens Games Hub.

## Draughts Arena — remaining verification / work
- [ ] Verify AI difficulty selection affects actual AI move strength in full matches.
- [ ] Verify matchmaking queue, queue status, timeout, cancel, and rating-based pairing.
- [ ] Verify player names and avatars on live match cards, tournament fixtures, spectator cards, and replay.
- [ ] Verify match clocks, time controls, pause/disconnect/reconnect handling.
- [ ] Verify rematch and friend challenge flows.
- [ ] Verify move list, notation, replay speed/play-pause, and profile match history.
- [ ] Verify spectator privacy, delay, and read-only access.
- [ ] Validate tournament bracket advancement, tie-breakers, standings, placement payouts, and idempotency.
- [ ] Audit reward RPCs, RLS policies, ledger constraints, replay policies, and admin operations.
- [ ] Verify cosmetics, clubs/teams, in-match emotes, and player profile game tabs.
- [ ] Verify mobile accessibility, screen-reader labels, keyboard controls, and reduced-motion options.

## Release gates
- [ ] TypeScript and ESLint pass.
- [ ] Unit and integration tests pass.
- [ ] Production build passes.
- [ ] Supabase migration and RLS/security advisor review complete.
- [ ] Android wrapper build passes.
- [ ] Real device gameplay tested at low, medium, and high graphics settings.
- [ ] Render deployment is live and production smoke tests pass.
