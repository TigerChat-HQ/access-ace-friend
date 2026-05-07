## TigerChat — Phase 9 finish + Social/Admin upgrades

### 1. Phase 9 — Screenshot protection wiring
- Add `no-select` and `privacy-blur` CSS utilities to `src/index.css` (user-select:none on `.no-select *`, blur(20px) on `.privacy-blur`).
- Call `useScreenshotProtection(true)` in `Chats.tsx` (when a chat is open) and `StoryViewer.tsx` (when mounted).
- Add a small "Screen privacy on" hint below the StoryViewer header so users know the limitation.

### 2. Story reactions — real-time + persisted
- StoryViewer already inserts into `story_reactions`. Add:
  - Real-time subscription to `story_reactions` for the current `story.id` so reactions from other viewers float up as animated emojis on the owner's screen.
  - Owner-side reaction count badge (e.g. ❤️ 12) using a fast aggregate query on viewer open.
- Show a small picker chip with current count for each emoji.

### 3. Stories grid — reliable video thumbnails
- Stories grid in `Stories.tsx` already detects `media_type === 'video'`. Improve by:
  - Adding `#t=0.1` fragment to `video.src` so first frame renders on iOS/Safari.
  - Showing a play-icon overlay on video tiles.
- StoryViewer already routes by `mediaType`; verify and keep.

### 4. Persist & load chat customization
- `useChatPreferences` already exposes `prefs`. Wire it in `Chats.tsx`:
  - Apply `wallpaperClass(prefs?.wallpaper)` as a CSS class on the messages scroll container.
  - Apply `fontSizeClass(prefs?.font_size)` on the messages list.
  - Pass `bubbleColorClass(prefs?.bubble_color)` to each `MessageBubble` via `myBubbleClass`.
- Ensure `ChatCustomizationDialog` upserts changes (already supported by hook) and the UI updates without refresh.

### 5. Easier group creation
- Replace checkbox list in `NewGroupDialog` with:
  - Search bar that filters profiles by name/username.
  - Avatar grid with quick tap-to-add chips at the top showing selected members.
  - Optional "Skip name" → auto-name from first 3 member names.
  - Friendly empty state with link to Search if no users yet.
- Make the trigger button bigger and labeled "New group" on the Groups page header so it is more discoverable.

### 6. Follow / followed-by — already in place, polish
- Profile page already shows Follow button + counts. Add:
  - Tappable Followers/Following counts → open a list dialog (`FollowListDialog`) showing users with Follow-back buttons.
  - On `Notifications.tsx`, ensure follow notifications link to the actor's profile (already via useNotifications, just verify).

### 7. Account administration in Profile
- In Profile (own profile) add a collapsible "Account" section with:
  - Toggle "Private account" (writes `profiles.is_private`).
  - "Change password" → `/settings` deep link.
  - "Sign out" (already present, move into this section).
  - "Delete account data" — calls a new edge function `delete-account` that removes the user's posts, comments, conversations they own, and finally `auth.admin.deleteUser`.
- Admin shortcut button (Shield icon) is already present for admins; keep.

### 8. Admin panel additions
- Extend `Admin.tsx`:
  - Promote/demote users to/from `admin` role via `user_roles` (insert/delete).
  - View & resolve `reports` (set status='resolved').
  - Quick search users by username.
- Already gated by `useUserRole().isAdmin` — keep.

### 9. Sign-up without admin approval (already true)
- Confirmed: `handle_new_user` trigger creates a profile on signup; no approval step exists. No changes needed unless the user wants email verification disabled — leaving default (recommended).

### 10. Security linter pass
- Run linter after migrations. Expected items to address:
  - Confirm RLS enabled on `chat_preferences`, `story_reactions` (both already have policies — verify).
  - Storage policies on `stories` and `chat-media` buckets: ensure `INSERT` policy requires `auth.uid()::text = (storage.foldername(name))[1]` so users can only write under their own folder.

### Technical details (for engineers)

**New files:**
- `src/components/social/FollowListDialog.tsx` — followers/following modal.
- `supabase/functions/delete-account/index.ts` — secure account deletion via service role.

**Edited files:**
- `src/index.css` — add `.no-select` & `.privacy-blur` utilities.
- `src/components/chat/StoryViewer.tsx` — protection hook, realtime reactions, owner badges.
- `src/pages/Stories.tsx` — video thumbnail polish (play icon, `#t=0.1`).
- `src/pages/Chats.tsx` — protection hook, apply chat prefs to bubbles/wallpaper/font.
- `src/components/chat/NewGroupDialog.tsx` — searchable, chip-based UX.
- `src/pages/Profile.tsx` — Account section with private toggle + delete; tap counts.
- `src/pages/Admin.tsx` — role management + reports table + user search.

**DB migrations:**
- Storage policies for `stories` and `chat-media` (idempotent CREATE POLICY IF NOT EXISTS).
- No table schema changes required — all needed tables already exist.

**Realtime:**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.story_reactions;` (if not already added).

### Deliverable order
1. CSS + Phase 9 wiring (Chats + StoryViewer).
2. Chat prefs application in Chats.
3. Story reactions realtime + grid polish.
4. NewGroupDialog UX overhaul.
5. Profile account section + FollowListDialog.
6. Admin extensions.
7. `delete-account` edge function.
8. Storage RLS migration + linter check.
