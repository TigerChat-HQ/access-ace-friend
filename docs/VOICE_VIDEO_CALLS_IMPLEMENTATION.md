# TIGERCHATS Voice & Video Calling — Main-branch implementation brief

> Status: implementation specification only. This document does not mean calling is implemented or production-ready.

## Goal
Deliver real one-to-one voice and video calls between two authenticated TIGERCHATS users, plus a persistent Call History section. Use the existing application and Supabase project; do not create a new Supabase project or weaken authentication/authorization.

## Existing call implementation to audit
- `src/hooks/useWebRTC.ts`
- `src/contexts/CallContext.tsx`
- `src/components/chat/CallDialog.tsx`
- `src/hooks/usePresence.ts`
- `src/components/chat/ChatView.tsx`
- Existing `public.call_signals` schema, RLS policies and Realtime configuration.

A known issue from the audit: call action buttons in `ChatView.tsx` appeared without working `onClick` handlers. Verify current main before changing.

## Required calling behavior
1. Wire voice/video buttons to the correct recipient and conversation. Prevent duplicate calls and self-calls.
2. Outgoing state: calling/ringing, then connecting/connected; show declined, busy, unavailable, failed, and no-answer/missed states accurately.
3. Incoming state: immediate ringing while recipient is online, with caller display name/avatar, audible ringtone where browser policy permits, vibration where supported, and Answer/Decline actions.
4. Handle answer, reject, hangup, missed, timeout, network loss, reconnecting, tab refresh, stale sessions, duplicate and out-of-order signals on both peers.
5. WebRTC media: microphone and camera permission handling; remote audio playback; remote video; local picture-in-picture preview; `playsInline`; autoplay fallback; cleanup all tracks on end.
6. In-call controls: mute/unmute, camera on/off, front/back camera switch, speaker/audio route control where browser/device APIs support it, call duration, end call, connection quality/reconnecting indicator.
7. Presence: use authenticated Supabase Realtime Presence for online state. Presence is a UX hint, not proof that a device can receive a call. Never block a valid call solely because presence says offline.
8. Notifications: integrate incoming-call push only with the app's existing configured push infrastructure. If credentials/service worker are absent, document setup; do not fake push delivery.
9. Connectivity: configure STUN plus production TURN using server-side secrets/configuration. Do not ship public demo TURN credentials. Document required TURN variables and secure credential rotation.
10. Security: enforce participant-only signaling access with RLS; validate caller/callee/conversation membership. Do not trust client-supplied identity. Do not label calls end-to-end encrypted unless genuine E2EE is implemented and verified.

## Call History / Call Log — required feature
Create a dedicated Call History screen reachable from the app's main navigation or calls area. It must persist across sessions and devices for the signed-in user.

### Filters and record types
- **All** — every call involving the current user.
- **Missed** — incoming calls that rang but were not answered (including timed-out calls); distinguish declined calls if shown.
- **Received** — incoming calls answered by the current user.
- **Outgoing** — calls initiated by the current user, with answered/unanswered status visible.

### Each history row
- Contact display name and avatar.
- Voice or video call icon/type.
- Date and time, localized to the user's device.
- Status (missed, received, outgoing, declined, failed) and duration for answered calls.
- Tap row/contact to open the conversation or contact; provide a call-back action that starts the same call type.
- Allow deleting an individual history entry and clearing the current user's history, with confirmation and safe error handling.
- Empty, loading, pagination, and error states; accessible labels and mobile-friendly layout.

### Data model and consistency
Inspect existing call tables first. Add an idempotent migration only where needed. A call record should include a stable call/session ID, caller_id, callee_id, conversation_id, call_type, status, started_at, answered_at, ended_at, duration_seconds, and created_at/updated_at as appropriate.
- Store one canonical call session, not duplicate records per participant. Query the user's history where they are caller or callee and derive direction/status from authenticated user ID.
- Record terminal outcomes exactly once; handle duplicate/out-of-order signaling idempotently.
- Only authenticated participants may read a call session. A user may delete/hide only their own history view; deleting history must not erase the other participant's history.
- Restrict insert/update to valid participants and validate conversation membership. Do not allow users to spoof caller/callee IDs or duration/status.
- Index caller_id, callee_id, started_at and relevant status/session fields. Enable Realtime only if needed and scope subscriptions to the current user's sessions.
- Never expose SDP/ICE payloads in call-history UI or to unrelated users.

## Database and Realtime
Inspect the existing `call_signals` schema before migrations. Make only backward-compatible, idempotent migrations if needed. Confirm Realtime publication and RLS for both participants. Avoid exposing SDP/ICE signals to unrelated users.

## Required tests before completion
- Unit/integration tests for outgoing offer, incoming ringing, accept, decline, hangup, missed timeout, duplicate/out-of-order signals, ICE candidates arriving before/after remote description, permission denied, reconnect/failure, and cleanup.
- Call History tests: All/Missed/Received/Outgoing filters, caller/callee direction, answered duration, missed timeout, deletion isolation between participants, clear-history isolation, and RLS.
- Run lint, typecheck, tests, and production build; fix failures.
- Manually test two distinct accounts on two real devices/browsers over different networks, for voice and video in both directions, including offline/background and permission-denied cases.
- Record what passed and what remains blocked by missing credentials/device access.

## Acceptance criteria
A call is considered real only when audio/video media flows between two distinct authenticated users—not merely when a dialog opens or a database signal is inserted. Call History is complete only when real call outcomes persist and each participant sees/deletes only their own history. Do not claim production-ready until the two-device test passes. Keep existing app features, roles, and Supabase data intact.
