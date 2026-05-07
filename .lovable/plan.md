## TigerChat Major Upgrade Plan

This is a large multi-feature upgrade. I'll break it into phases so we can ship and verify each one. Below is the proposed scope, ordered by impact and dependency.

### Phase 1 — Messaging core fixes (highest priority)
- **Read receipts (WhatsApp-style ticks)**: add `delivered_at` and `read_at` columns to `messages`. Show ✓ (sent), ✓✓ grey (delivered), ✓✓ blue (seen). Mark messages delivered on realtime arrival, mark read when chat is open and visible.
- **Unread counter auto-clear**: when user opens a conversation, mark all incoming messages read; counter updates instantly via realtime.
- **Real-time notifications fix**: audit `useNotifications` so likes / comments / follows / new messages / story reactions all fire correctly without refresh; add toast + badge updates.

### Phase 2 — Comments thread (replies + likes)
- Add `parent_id` to `post_comments` for nested replies, and a new `comment_likes` table.
- Update `CommentsSheet` to render a threaded view with collapsible replies, like button per comment, smooth animations.
- Notifications for comment replies and comment likes.

### Phase 3 — Navigation & Settings access
- Reorder bottom nav: Home, Chats, **Groups** (new tab filtered to group conversations), Stories, Profile.
- Add a persistent settings icon in every page header (top-right) linking to `/settings`.
- Move Create + Search into the Home header / Stories tab to keep nav at 5 items.

### Phase 4 — Group management
- Group settings sheet (admins only): rename group, change avatar (upload to `chat-media`), remove members, promote/demote admins, toggle join-request mode, generate invite link.
- Join requests table + approval flow.

### Phase 5 — Chat customization (3-dot menu)
- Per-conversation settings stored in a new `chat_preferences` table (user_id + conversation_id): wallpaper preset, bubble color, font size, theme override.
- Built-in wallpapers (tiger theme, gradients, solid, light, dark) + custom upload.
- Apply preferences live in `ChatView`.

### Phase 6 — Stories upgrade
- Support video stories up to 2 minutes (add `media_type`, `duration` columns).
- Text overlays, music overlay (existing), reactions table (`story_reactions`).
- Optimize loader (preload next, blur-up).

### Phase 7 — Feed algorithm + Trending
- Compute engagement score in `recommend-posts` edge function: `likes*1 + comments*2 + recency_decay`. Already AI-ranked; add rule-based trending fallback.
- New "Trending" rail on Home showing top posts in last 48h worldwide.

### Phase 8 — Media editor (lightweight)
- Pre-upload editor in `Create`: crop (react-easy-crop), filters (CSS), text/sticker overlays rendered to canvas, video trim (ffmpeg.wasm — heavy, optional).
- Music picker from a curated list.

### Phase 9 — Screenshot protection (best effort on web)
- Add CSS `user-select:none`, disable context menu in chats/stories/media viewer.
- Detect Page Visibility blur and overlay a privacy screen. *Note: true screenshot blocking is not possible in browser PWAs — only native apps can enforce it. Will document this limitation.*

### Technical notes
- DB migrations needed for: `messages.delivered_at`, `messages.read_at`, `post_comments.parent_id`, `comment_likes`, `chat_preferences`, `group_join_requests`, `story_reactions`, `stories.media_type`, `stories.duration`.
- New edge function updates: `recommend-posts` for trending.
- New hooks: `useReadReceipts`, `useChatPreferences`, `useCommentReplies`, `useTrendingPosts`.
- Major new components: `GroupManagementSheet`, `ChatCustomizationSheet`, `MediaEditor`, `TrendingRail`, `StoryComposer` (video).

### Recommendation
Given the size (~9 phases, ~20 new files, ~10 DB migrations), I propose **shipping Phases 1–4 first** in this iteration (messaging fixes, comment threads, nav reorganization, group management). These deliver the most user-visible value and unblock the rest. Phases 5–9 follow in subsequent iterations.

**Reply with:**
- "go" to ship Phases 1–4 now
- a different phase selection (e.g. "do 1, 6, 7")
- or adjustments to the plan
