-- Fix: avoid PostgREST safety error by adding WHERE clauses to bulk deletes
CREATE OR REPLACE FUNCTION public.reset_entire_fila()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem resetar a fila';
  END IF;

  -- Clear fila safely (explicit WHERE clause)
  DELETE FROM public.fila WHERE TRUE;
  
  -- Recreate fila from profiles
  INSERT INTO public.fila (usuario_id, nome_usuario, ordem, status)
  SELECT p.user_id, COALESCE(p.display_name, 'Usuário'),
         ROW_NUMBER() OVER (ORDER BY p.created_at) AS ordem,
         'pendente'::public.fila_status
  FROM public.profiles p
  WHERE p.user_id IS NOT NULL;

  -- Activate first pending
  UPDATE public.fila AS f
  SET status = 'ativo', iniciou_em = now()
  WHERE f.id = (
    SELECT id FROM public.fila WHERE status = 'pendente' ORDER BY ordem LIMIT 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_volleyball_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem limpar a lista de vôlei';
  END IF;

  -- Clear volleyball queue safely
  DELETE FROM public.volleyball_queue WHERE TRUE;
END;
$function$;