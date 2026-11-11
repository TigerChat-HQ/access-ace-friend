# TigerChat Games Arena rollout checklist

This document is the source-of-truth checklist for the Games Hub, Draughts Arena completion, and 4D Pool delivery. Do not mark a feature complete until its UI, persistence, authorization, and end-to-end tests are verified.

## Delivered in this branch
- [x] New responsive Games Hub route at `/games` with Draughts, 4D Pool preview, and Tiger Quiz entry points.
- [x] Main app navigation now opens Games Hub.
- [x] Draughts AI difficulty selector exposes Easy, Medium, Hard, and Expert before starting.
- [x] Draughts menu links back to Games Hub.
- [x] Draughts Season Pass (10 levels) is rendered with XP gates and claim state.
- [x] Draughts Top 100 list renders up to 100 ranked players and profile display names/avatars when visible.
- [x] League standings are sorted by points and played matches.
- [x] 4D Pool interactive local preview: perspective table, cue aiming, power, ball collision, rail rebound, pocket detection, reset, 8-ball/9-ball rack layouts, and top/angle camera switch.
- [x] Existing quiz is renamed Tiger Quiz Arena and remains available from Games Hub.

## Draughts Arena — remaining verification / work
- [ ] Verify AI difficulty selection affects the actual AI move strength in full matches.
- [ ] Add robust matchmaking queue, queue status, timeout, cancel, and rating-based pairing (current Quick Match is an open-lobby shortcut).
- [ ] Add player display names/avatars to live match cards, tournament fixtures, spectator cards, and replay.
- [ ] Add match clocks, time controls, pause/disconnect/reconnect handling.
- [ ] Add rematch and friend challenge flows.
- [ ] Complete move list, notation, replay speed/play-pause, and replay access from profile history.
- [ ] Validate spectator privacy, delay, and read-only access.
- [ ] Validate tournament bracket advancement, tie-breakers, standings, placement payouts, and idempotency.
- [ ] Audit every reward RPC, RLS policy, ledger constraint, replay policy, and admin operation; test abuse and duplicate claims.
- [ ] Add missing cosmetics shop, clubs/teams, in-match emotes, and player profile game tabs.
- [ ] Add full mobile accessibility, screen-reader labels, keyboard controls, and reduced-motion options.

## 4D Pool — remaining production work
- [ ] Replace the current CSS-perspective/local physics preview with a dedicated WebGL 3D scene (Three.js/WebGPU with device fallback).
- [ ] Calibrate table, rails, cushions, pockets, cue, and ball dimensions against WPA 8/9-ball equipment specifications.
- [ ] Implement fixed-step deterministic rigid-body simulation, spin, throw, cushion response, pocket jaws, ball-in-hand, and foul rules.
- [ ] Implement complete 8-Ball and 9-Ball rules, break rules, turn ownership, wins/losses, rematch, and match clocks.
- [ ] Add practice drills, shot history, ghost line settings, camera controls, quality presets, haptics, and real audio effects.
- [ ] Add AI opponents with difficulty tiers and validated legal shot selection.
- [ ] Add authenticated PvP rooms, matchmaking, authoritative server simulation, reconnect/resume, and anti-cheat.
- [ ] Add Pool tournaments, spectator mode, rankings, player profiles, season pass, missions, achievements, cosmetics, and a separate Pool Coins ledger.
- [ ] Add server-side result settlement and idempotent rewards; never trust client-reported winners or balances.
- [ ] Add RLS, abuse/rate limits, integration tests, load tests, and Android low-memory/device performance checks.

## Release gates
- [ ] TypeScript and ESLint pass.
- [ ] Unit and integration tests pass.
- [ ] Production build passes.
- [ ] Supabase migration and RLS/security advisor review complete (if schema changes are introduced).
- [ ] Android wrapper build passes.
- [ ] Real device gameplay tested at low, medium, and high graphics settings.
- [ ] Render deployment is live and production smoke tests pass.
