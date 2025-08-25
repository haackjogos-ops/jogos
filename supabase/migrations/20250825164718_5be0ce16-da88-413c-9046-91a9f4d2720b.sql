-- Create enum type for fila status
DO $$ BEGIN
  CREATE TYPE public.fila_status AS ENUM ('pendente','ativo','finalizado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create fila table
CREATE TABLE IF NOT EXISTS public.fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  nome_usuario text NOT NULL,
  ordem integer NOT NULL,
  iniciou_em timestamptz,
  concluiu_em timestamptz,
  status public.fila_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fila ENABLE ROW LEVEL SECURITY;

-- Keep only one active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_fila_single_active
ON public.fila (status)
WHERE status = 'ativo';

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS update_fila_updated_at ON public.fila;
CREATE TRIGGER update_fila_updated_at
BEFORE UPDATE ON public.fila
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Policies
DROP POLICY IF EXISTS "Fila is viewable by everyone" ON public.fila;
CREATE POLICY "Fila is viewable by everyone"
ON public.fila FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert themselves into fila" ON public.fila;
CREATE POLICY "Users can insert themselves into fila"
ON public.fila FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Users can update their own fila row" ON public.fila;
CREATE POLICY "Users can update their own fila row"
ON public.fila FOR UPDATE
USING (auth.uid() = usuario_id);

-- Function: initialize fila from profiles if empty
CREATE OR REPLACE FUNCTION public.initialize_fila_if_empty()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.fila) = 0 THEN
    INSERT INTO public.fila (usuario_id, nome_usuario, ordem, status)
    SELECT p.user_id, COALESCE(p.display_name, 'Usuário'),
           ROW_NUMBER() OVER (ORDER BY p.created_at) AS ordem,
           'pendente'::public.fila_status
    FROM public.profiles p
    WHERE p.user_id IS NOT NULL;

    -- Start first as active if exists and no active
    IF NOT EXISTS (SELECT 1 FROM public.fila WHERE status = 'ativo') THEN
      UPDATE public.fila f
      SET status = 'ativo', iniciou_em = now()
      WHERE f.id = (
        SELECT id FROM public.fila WHERE status = 'pendente' ORDER BY ordem LIMIT 1
      );
    END IF;
  END IF;
END;
$$;

-- Function: get active fila with remaining seconds
CREATE OR REPLACE FUNCTION public.get_active_fila()
RETURNS TABLE (
  id uuid,
  usuario_id uuid,
  nome_usuario text,
  ordem integer,
  iniciou_em timestamptz,
  concluiu_em timestamptz,
  status public.fila_status,
  remaining_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.usuario_id, f.nome_usuario, f.ordem, f.iniciou_em, f.concluiu_em, f.status,
    CASE 
      WHEN f.iniciou_em IS NULL THEN NULL
      ELSE GREATEST(0, 60 - FLOOR(EXTRACT(EPOCH FROM (now() - f.iniciou_em)))::int)
    END AS remaining_seconds
  FROM public.fila f
  WHERE f.status = 'ativo'
  ORDER BY f.iniciou_em DESC
  LIMIT 1;
END;
$$;

-- Function: advance fila if expired and ensure one active
CREATE OR REPLACE FUNCTION public.advance_fila()
RETURNS TABLE (
  id uuid,
  usuario_id uuid,
  nome_usuario text,
  ordem integer,
  iniciou_em timestamptz,
  concluiu_em timestamptz,
  status public.fila_status,
  remaining_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active public.fila%ROWTYPE;
BEGIN
  -- Finish active if expired (> 60s)
  SELECT * INTO v_active FROM public.fila WHERE status = 'ativo' ORDER BY iniciou_em DESC LIMIT 1;

  IF v_active.id IS NOT NULL AND v_active.iniciou_em IS NOT NULL AND (now() - v_active.iniciou_em) > interval '60 seconds' THEN
    UPDATE public.fila SET status = 'finalizado', concluiu_em = now() WHERE id = v_active.id;
  END IF;

  -- Ensure we have one active
  IF NOT EXISTS (SELECT 1 FROM public.fila WHERE status = 'ativo') THEN
    UPDATE public.fila f
    SET status = 'ativo', iniciou_em = now()
    WHERE f.id = (
      SELECT id FROM public.fila WHERE status = 'pendente' ORDER BY ordem LIMIT 1
    );
  END IF;

  -- Return active with remaining seconds
  RETURN QUERY
  SELECT f.id, f.usuario_id, f.nome_usuario, f.ordem, f.iniciou_em, f.concluiu_em, f.status,
    CASE 
      WHEN f.iniciou_em IS NULL THEN NULL
      ELSE GREATEST(0, 60 - FLOOR(EXTRACT(EPOCH FROM (now() - f.iniciou_em)))::int)
    END AS remaining_seconds
  FROM public.fila f
  WHERE f.status = 'ativo'
  ORDER BY f.iniciou_em DESC
  LIMIT 1;
END;
$$;

-- Function: add volleyball queue mark with limit of 2 per active turn
CREATE OR REPLACE FUNCTION public.add_volleyball_mark(player_name text, skill_level text DEFAULT 'iniciante')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_active public.fila%ROWTYPE;
  v_marks_count int;
  v_confirmed_count int;
  v_is_waiting boolean;
  v_position int;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_active FROM public.fila WHERE status = 'ativo' ORDER BY iniciou_em DESC LIMIT 1;
  IF v_active.id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário ativo na fila.';
  END IF;
  IF v_active.usuario_id <> auth.uid() THEN
    RAISE EXCEPTION 'Não é a sua vez. Aguarde.';
  END IF;
  IF v_active.iniciou_em IS NOT NULL AND (now() - v_active.iniciou_em) > interval '60 seconds' THEN
    RAISE EXCEPTION 'Tempo esgotado para este turno.';
  END IF;

  SELECT COUNT(*) INTO v_marks_count
  FROM public.volleyball_queue q
  WHERE q.marked_by_user_id = auth.uid()
    AND q.marked_at >= COALESCE(v_active.iniciou_em, now());

  IF v_marks_count >= 2 THEN
    RAISE EXCEPTION 'Limite de 2 marcações por turno atingido.';
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count FROM public.volleyball_queue WHERE is_waiting = false;
  v_is_waiting := v_confirmed_count >= 12;
  IF v_is_waiting THEN
    SELECT COUNT(*) + 1 INTO v_position FROM public.volleyball_queue WHERE is_waiting = true;
  ELSE
    v_position := v_confirmed_count + 1;
  END IF;

  INSERT INTO public.volleyball_queue (player_name, marked_by_user_id, position, is_waiting, skill_level)
  VALUES (player_name, auth.uid(), v_position, v_is_waiting, skill_level)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
