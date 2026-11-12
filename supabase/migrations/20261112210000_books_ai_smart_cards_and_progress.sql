-- Books AI chapters, account-synced reading progress, and sourced daily Smart Cards.
-- All user-owned progress is isolated by auth.uid(); generated public content is read-only to clients.

CREATE TABLE IF NOT EXISTS public.books_daily_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id text NOT NULL CHECK (story_id IN ('mji-wa-siri','barua-usiku','kivuli-msituni')),
  episode_number integer NOT NULL CHECK (episode_number > 0),
  publish_date date NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(body) BETWEEN 300 AND 12000),
  recap text NOT NULL CHECK (length(recap) BETWEEN 20 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, episode_number),
  UNIQUE (story_id, publish_date)
);
CREATE INDEX IF NOT EXISTS books_daily_chapters_latest_idx
  ON public.books_daily_chapters (story_id, episode_number DESC);
ALTER TABLE public.books_daily_chapters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.books_daily_chapters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.books_daily_chapters TO authenticated;
DROP POLICY IF EXISTS "Signed-in users can read daily book chapters" ON public.books_daily_chapters;
CREATE POLICY "Signed-in users can read daily book chapters"
  ON public.books_daily_chapters FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.books_reading_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id text NOT NULL CHECK (length(book_id) BETWEEN 1 AND 100),
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_chapter integer NOT NULL DEFAULT 0 CHECK (last_chapter >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX IF NOT EXISTS books_reading_progress_updated_idx
  ON public.books_reading_progress (user_id, updated_at DESC);
ALTER TABLE public.books_reading_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.books_reading_progress FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books_reading_progress TO authenticated;
DROP POLICY IF EXISTS "Users read their own book progress" ON public.books_reading_progress;
CREATE POLICY "Users read their own book progress"
  ON public.books_reading_progress FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users create their own book progress" ON public.books_reading_progress;
CREATE POLICY "Users create their own book progress"
  ON public.books_reading_progress FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users update their own book progress" ON public.books_reading_progress;
CREATE POLICY "Users update their own book progress"
  ON public.books_reading_progress FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users delete their own book progress" ON public.books_reading_progress;
CREATE POLICY "Users delete their own book progress"
  ON public.books_reading_progress FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.tiger_ai_smart_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_date date NOT NULL,
  placement text NOT NULL CHECK (placement IN ('post','status')),
  category text NOT NULL CHECK (category IN ('sheria','elimu','historia','afya','maarifa')),
  source_key text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  hook text NOT NULL CHECK (length(hook) BETWEEN 3 AND 220),
  body text NOT NULL CHECK (length(body) BETWEEN 20 AND 1800),
  source_title text NOT NULL,
  source_reference text,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  jurisdiction text,
  read_more_url text NOT NULL CHECK (read_more_url ~ '^/books'),
  verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publish_date, placement, source_key)
);
CREATE INDEX IF NOT EXISTS tiger_ai_smart_cards_feed_idx
  ON public.tiger_ai_smart_cards (publish_date DESC, created_at DESC)
  WHERE is_active = true;
ALTER TABLE public.tiger_ai_smart_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tiger_ai_smart_cards FROM PUBLIC, anon;
GRANT SELECT ON public.tiger_ai_smart_cards TO authenticated;
DROP POLICY IF EXISTS "Signed-in users can read published Tiger AI Smart Cards" ON public.tiger_ai_smart_cards;
CREATE POLICY "Signed-in users can read published Tiger AI Smart Cards"
  ON public.tiger_ai_smart_cards FOR SELECT TO authenticated
  USING (is_active = true AND publish_date <= (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date);

-- Private-to-clients scheduler credential. Edge Function uses service_role; cron runs as database owner.
CREATE TABLE IF NOT EXISTS public.tiger_books_ai_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cron_token text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tiger_books_ai_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tiger_books_ai_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tiger_books_ai_config TO service_role;
INSERT INTO public.tiger_books_ai_config (id, cron_token, enabled)
VALUES (true, gen_random_uuid()::text || gen_random_uuid()::text, true)
ON CONFLICT (id) DO NOTHING;

-- First sourced cards are inserted from reviewed official law texts and published learning research.
INSERT INTO public.tiger_ai_smart_cards
  (publish_date, placement, category, source_key, title, hook, body, source_title, source_reference, source_url, jurisdiction, read_more_url, verified, is_active)
VALUES
  (current_date, 'post', 'sheria', 'law-child',
   'JE, WAJUA? Haki na ustawi wa mtoto',
   'Sheria ya Mtoto inaweka msingi wa haki, ulinzi na ustawi wa mtoto.',
   'The Law of the Child Act, 2009 (Act No. 21 of 2009), Cap. 13, inaweka masharti kuhusu haki na ustawi wa mtoto; pia inahusu malezi, kuasili, uangalizi, ajira ya watoto na watoto wanaokinzana na sheria.',
   'Office of the Attorney General — OAG MIS',
   'The Law of the Child Act, Act No. 21 of 2009, Cap. 13; revised publication 25 Apr 2025',
   'https://oagmis.oag.go.tz/portal/revised-acts/revised/118',
   'Tanzania Bara', '/books?book=law-child', true, true),
  (current_date, 'status', 'sheria', 'cybercrimes-act',
   'Sheria za matumizi ya TEHAMA',
   'JE, WAJUA? Tanzania ina Cybercrimes Act, 2015.',
   'Sheria hii inahusu makosa yanayohusiana na mifumo ya kompyuta na TEHAMA, pamoja na uchunguzi na matumizi ya ushahidi wa kielektroniki.',
   'Office of the Attorney General — OAG MIS',
   'The Cybercrimes Act, 2015, Act No. 14 of 2015, Cap. 443; revised publication 25 Apr 2025',
   'https://oagmis.oag.go.tz/portal/revised-acts/revised/543',
   'Tanzania Bara', '/books?book=cybercrimes-act', true, true),
  (current_date, 'status', 'sheria', 'employment-act',
   'Haki za msingi kazini',
   'JE, WAJUA? Kuna sheria maalumu ya ajira na mahusiano kazini.',
   'Employment and Labour Relations Act, 2004, Cap. 366, inahusu haki za msingi za kazi, viwango vya ajira, majadiliano ya pamoja na mfumo wa kuzuia na kutatua migogoro.',
   'Office of the Attorney General — OAG MIS',
   'The Employment and Labour Relations Act, 2004, Act No. 6 of 2004, Cap. 366; revised publication 25 Apr 2025',
   'https://oagmis.oag.go.tz/portal/revised-acts/revised/570',
   'Tanzania Bara', '/books?book=employment-act', true, true),
  (current_date, 'post', 'elimu', 'education-act',
   'JE, WAJUA? Sheria ya Elimu',
   'Mfumo wa elimu una msingi wake wa kisheria.',
   'The Education Act, Cap. 353, imeelezwa na Ofisi ya Mwanasheria Mkuu kuwa sheria inayolenga maendeleo bora ya mfumo wa elimu. Fungua hati rasmi ili kusoma vifungu na masharti kamili.',
   'Office of the Attorney General — OAG MIS',
   'The Education Act, Cap. 353; revised publication 25 Apr 2025',
   'https://oagmis.oag.go.tz/portal/revised-acts/revised/457',
   'Tanzania Bara', '/books?book=education-act', true, true),
  (current_date, 'status', 'elimu', 'learning-spacing',
   'Jifunze kwa vipindi',
   'JE, WAJUA? Kusoma kila kitu mara moja si njia pekee ya kujifunza.',
   'Mapitio ya Nature Reviews Psychology yanaeleza ushahidi kuhusu kurudia kujifunza kwa vipindi tofauti na kujipima kwa kukumbuka taarifa. Matokeo hutegemea namna ya kutumia mbinu hizo na mazingira ya mwanafunzi.',
   'Nature Reviews Psychology',
   'Carpenter, Pan & Butler (2022), The science of effective learning with spacing and retrieval practice',
   'https://www.nature.com/articles/s44159-022-00089-1',
   NULL, '/books?book=learning-science', true, true),
  (current_date, 'status', 'elimu', 'learning-retrieval',
   'Jipime kwa kukumbuka',
   'JE, WAJUA? Jaribu kujibu bila kuangalia daftari kwanza.',
   'Mwongozo wa Australian Education Research Organisation unaeleza kuwa kuomba mwanafunzi akumbuke alichojifunza na kurudia mazoezi kwa vipindi kunaweza kusaidia taarifa kubaki kwenye kumbukumbu kwa muda mrefu.',
   'Australian Education Research Organisation',
   'Spacing and retrieval practice guide',
   'https://www.edresearch.edu.au/guides-resources/practice-guides/spacing-and-retrieval-practice-guide-full-publication',
   NULL, '/books?book=learning-science', true, true)
ON CONFLICT (publish_date, placement, source_key) DO NOTHING;

-- Run at 06:00 Africa/Dar_es_Salaam (03:00 UTC). The function is idempotent per story/date.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'tiger-books-ai-daily';
SELECT cron.schedule(
  'tiger-books-ai-daily',
  '0 3 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://dngilyoyhmgazhuuaxfh.supabase.co/functions/v1/tiger-books-ai',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'token', (SELECT cron_token FROM public.tiger_books_ai_config WHERE id = true),
        'trigger', 'scheduled'
      ),
      timeout_milliseconds := 120000
    );
  $job$
);
