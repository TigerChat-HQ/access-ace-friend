
-- Trophies catalog
CREATE TABLE public.trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL UNIQUE,
  name text NOT NULL,
  min_score integer NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trophies viewable" ON public.trophies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage trophies insert" ON public.trophies FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superior_admin'));
CREATE POLICY "Admins manage trophies update" ON public.trophies FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superior_admin'));
CREATE POLICY "Admins manage trophies delete" ON public.trophies FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superior_admin'));

INSERT INTO public.trophies(tier,name,min_score,icon,color) VALUES
  ('bronze','Bronze Tiger',40,'🥉','#cd7f32'),
  ('silver','Silver Tiger',60,'🥈','#c0c0c0'),
  ('gold','Gold Tiger',75,'🥇','#ffd700'),
  ('platinum','Platinum Tiger',90,'🏆','#e5e4e2'),
  ('diamond','Diamond Tiger',100,'💎','#b9f2ff');

-- Game questions
CREATE TABLE public.game_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  difficulty text NOT NULL DEFAULT 'easy',
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions readable by authenticated" ON public.game_questions FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "Admins insert questions" ON public.game_questions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superior_admin'));
CREATE POLICY "Admins update questions" ON public.game_questions FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superior_admin'));
CREATE POLICY "Admins delete questions" ON public.game_questions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superior_admin'));

-- Seed Tanzanian Draft questions
INSERT INTO public.game_questions(category,difficulty,question,options,correct_index,explanation) VALUES
  ('geography','easy','What is the capital city of Tanzania?','["Dar es Salaam","Dodoma","Arusha","Mwanza"]',1,'Dodoma is the official capital since 1996.'),
  ('geography','easy','Which is the highest mountain in Africa, located in Tanzania?','["Mount Kenya","Mount Meru","Mount Kilimanjaro","Mount Rwenzori"]',2,'Mount Kilimanjaro stands at 5,895m.'),
  ('history','medium','Who was the first President of Tanzania?','["Ali Hassan Mwinyi","Julius Nyerere","Benjamin Mkapa","Jakaya Kikwete"]',1,'Mwalimu Julius Nyerere served from 1964 to 1985.'),
  ('culture','easy','What is the national language of Tanzania?','["English","French","Swahili","Arabic"]',2,'Kiswahili is the official national language.'),
  ('geography','medium','Which lake borders Tanzania to the west?','["Lake Victoria","Lake Tanganyika","Lake Malawi","Lake Turkana"]',1,'Lake Tanganyika is the longest freshwater lake.'),
  ('sports','easy','Which is Tanzania''s most popular football club?','["Simba SC","Yanga","Azam FC","All of the above"]',3,'All three are top Tanzanian clubs.'),
  ('history','medium','In what year did Tanzania gain independence?','["1960","1961","1962","1964"]',1,'Tanganyika gained independence in 1961; Tanzania formed in 1964.'),
  ('geography','hard','Which national park is famous for the Great Migration?','["Ruaha","Selous","Serengeti","Tarangire"]',2,'The Serengeti hosts the annual wildebeest migration.'),
  ('culture','easy','What does "Karibu" mean in Swahili?','["Goodbye","Welcome","Thank you","Sorry"]',1,'Karibu means welcome.'),
  ('history','hard','The union that formed Tanzania joined Tanganyika with which island?','["Pemba","Mafia","Zanzibar","Madagascar"]',2,'Tanganyika united with Zanzibar in 1964.');

-- Game attempts
CREATE TABLE public.game_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score integer NOT NULL,
  correct_count integer NOT NULL,
  total_questions integer NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  trophy_tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attempts viewable by everyone" ON public.game_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own attempts" ON public.game_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User trophies
CREATE TABLE public.user_trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trophy_tier text NOT NULL,
  attempt_id uuid,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, trophy_tier)
);
ALTER TABLE public.user_trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User trophies viewable" ON public.user_trophies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users earn own trophies" ON public.user_trophies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_game_attempts_user ON public.game_attempts(user_id, created_at DESC);
CREATE INDEX idx_game_attempts_score ON public.game_attempts(score DESC);
CREATE INDEX idx_user_trophies_user ON public.user_trophies(user_id);
