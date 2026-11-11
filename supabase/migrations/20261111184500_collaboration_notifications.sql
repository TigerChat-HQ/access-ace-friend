-- Collaboration invitations and responses are first-class social notifications.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like','comment','follow','mention','reply','comment_like','report_reply',
    'collaboration_invite','collaboration_accepted'
  ));
