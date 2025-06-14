
-- Tabla para almacenar resultados de tests
CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  topic TEXT,
  detail JSONB -- puede guardar info de respuestas, preguntas, etc.
);

-- Row Level Security para test_results
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test results"
  ON public.test_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test results"
  ON public.test_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test results"
  ON public.test_results
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test results"
  ON public.test_results
  FOR DELETE
  USING (auth.uid() = user_id);

-- Tabla para registrar dudas frecuentes o consultas del chat
CREATE TABLE public.frequent_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  question TEXT NOT NULL,
  context TEXT, -- puede ser tema, subtema, etc.
  times_asked INTEGER DEFAULT 1
);

-- Row Level Security para frequent_questions
ALTER TABLE public.frequent_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own frequent questions"
  ON public.frequent_questions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own frequent questions"
  ON public.frequent_questions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own frequent questions"
  ON public.frequent_questions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own frequent questions"
  ON public.frequent_questions
  FOR DELETE
  USING (auth.uid() = user_id);
