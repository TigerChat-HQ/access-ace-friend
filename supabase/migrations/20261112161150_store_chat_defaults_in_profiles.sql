alter table public.profiles
  add column if not exists chat_defaults jsonb not null
  default '{"wallpaper":"default","bubble_color":"primary","font_size":"medium"}'::jsonb;

drop table if exists public.user_chat_defaults;
