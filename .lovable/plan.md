## TigerChats — Major Feature Expansion

This is a large, multi-system request. I'll group it into phases so we ship working pieces and avoid breaking existing flows. Some items (true peer-to-peer voice/video, native screenshot blocking, real biometric fingerprint) have hard browser limits — I'll explain what's actually achievable on the web.

---

### Phase A — Security & Privacy

**1. Fingerprint / biometric lock**

- Web cannot read a real fingerprint, but it CAN use **WebAuthn / passkeys** (Touch ID, Windows Hello, Android fingerprint) as a second factor / app lock.
- Add a "Require biometric to open app" toggle in Settings → registers a passkey via `navigator.credentials.create()`, then requires `navigator.credentials.get()` on app launch.
- Store credential ID on `profiles` (new column `passkey_credential_id`).

**3. Screenshot prevention**

- True blocking is impossible in a browser. We already blur on blur/visibility change.
- Strengthen: also blur on `Print Screen` keypress, disable drag/save on images, watermark sensitive views with the viewer's `@username` so leaked screenshots are traceable.

---

### Phase B — Stories and post: Music & Tiger Reactions

**2. Royalty-free background music**

- Add a **music picker** in `StoryUploadDialog` backed by a curated list of free tracks (Pixabay Music / Free Music Archive — public CDN URLs, no key needed).
- Built-in **trim slider** (start/end seconds, max 15s) using a lightweight `<audio>` + range UI; store `music_url`, `music_start`, `music_end` on `stories and posts`.
- Playback in `StoryViewer and post` respects the trim window.

**4. Tiger image & pop-up tiger reactions in stories and post**

- Add a 🐯 quick-reaction button alongside the existing emoji picker.
- When tapped, a large animated tiger PNG (generated asset) flies up across the viewer with a roar SFX, then is persisted to `story_reactions` so the owner sees who sent tigers.
- Same tiger animation triggers in chat when someone sends `🐯` or taps a new "Send Tiger" button in `MessageInput`.

---

### Phase C — Real Voice / Video Calls

**6. Make calls actually connect**

- We already have `useWebRTC` + `call_signals` table. Audit the signaling flow end-to-end:
  - Verify offer/answer/ICE exchange writes to `call_signals` with the right `signal_type`.
  - Add Realtime subscription so callee receives "incoming" within 1s.
  - Add Google STUN server (`stun:stun.l.google.com:19302`) so calls work across NATs.
  - Wire `CallDialog` accept/reject to actually create the peer connection and attach media.
- Result: real 1-to-1 voice & video over WebRTC between two logged-in users on the same network or via STUN.
- Note: full TURN relay (for strict NATs / cellular) needs a paid TURN server — not included.

---

### Phase D — Admin Power-Ups

**5. Roles, super-group governance, more admin tools**

- Extend `app_role` enum with `moderator` and `adviser`.
- New tab in Admin panel: **Role Management** — main admin can promote/demote any user to admin / moderator / adviser; moderators can resolve reports & delete posts but can't change roles; advisers are read-only.
- Admin Super Group: only main admin can add new admins/moderators/advisers to it; show role badges next to each member.
- New admin widgets: top hashtags, top posters, retention (DAU/WAU), report queue with bulk resolve.

---

### Phase E — Tiger AI Assistant + Trending Polish

**7. Tiger AI Assistant**

- New page `/tiger-ai` (and a floating 🐯 button on Notifications/Help) — chat UI backed by an edge function `tiger-ai` that calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with a TigerChats system prompt.
- When a user files a **report**, the AI auto-posts a first-response message ("Hi, I'm Tigerchat AI — here's what I found…") while the human admin reviews. Admin can override.

**Trending smoothness**

- Add swipe left or right to replay a message and swipe-to-refresh on Feed.
- Skeleton loaders on Stories/Feed/Chats lists.
- Cache the trending rail in `sessionStorage` for instant revisit.
- Add gentle spring animations to story thumbnails and post likes (framer-motion).

---

### Suggested Order

I recommend shipping in this order so each phase is independently usable:

1. **Phase C** (calls actually work) — highest user impact
2. **Phase B** (story music + tiger reactions) — big delight
3. **Phase D** (admin roles & super-group governance)
4. **Phase E** (Tiger AI + smoothness)
5. **Phase A** (passkey lock + screenshot hardening)

---

### Questions before I start

- **Tiger AI scope**: should it be a general help chatbot, OR specifically the "first responder" on user reports / DMs to admin? (I'll do both unless you say otherwise.)
- **Music library**: OK to ship ~20 curated Pixabay tracks hard-coded, or do you want an admin UI to manage the track list later?
- **Calls**: OK to ship with public Google STUN only (works for ~80% of users), and add a paid TURN server later?

Reply with answers (or just say "go") and I'll start with Phase C.