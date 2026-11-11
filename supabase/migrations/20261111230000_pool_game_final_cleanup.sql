-- Final cleanup after historical Pool migrations, so fresh installs do not recreate Pool.
-- The earlier removal migration is also recorded in production; this final
-- idempotent pass ensures local/fresh migration replay ends without Pool objects.
drop function if exists public.cancel_pool_match_queue();
drop function if exists public.create_pool_room(text, text, integer);
drop function if exists public.create_pool_tournament(text, text, integer, integer);
drop function if exists public.enqueue_pool_match(text, integer, integer);
drop function if exists public.join_pool_room(uuid, text);
drop function if exists public.join_pool_room_by_code(text);
drop function if exists public.join_pool_tournament(uuid);
drop function if exists public.list_pool_public_rooms();
drop function if exists public.pool_advance_tournament(uuid, integer);
drop function if exists public.pool_check_timeout(uuid);
drop function if exists public.pool_commit_server_shot(uuid, uuid, integer, jsonb, uuid, text, uuid, text, jsonb);
drop function if exists public.pool_initialize_match(uuid, uuid, jsonb);
drop function if exists public.pool_settle_match(uuid);
drop function if exists public.start_pool_tournament(uuid);
drop table if exists public.pool_tournament_matches cascade;
drop table if exists public.pool_tournament_entries cascade;
drop table if exists public.pool_match_results cascade;
drop table if exists public.pool_match_events cascade;
drop table if exists public.pool_match_queue cascade;
drop table if exists public.pool_user_cosmetics cascade;
drop table if exists public.pool_cosmetics cascade;
drop table if exists public.pool_coin_ledger cascade;
drop table if exists public.pool_wallets cascade;
drop table if exists public.pool_player_progression cascade;
drop table if exists public.pool_player_ratings cascade;
drop table if exists public.pool_matches cascade;
drop table if exists public.pool_tournaments cascade;
