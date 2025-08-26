-- Modificar a função add_volleyball_mark para permitir que os 12 primeiros confirmados marquem,
-- e após isso qualquer pessoa possa marcar

CREATE OR REPLACE FUNCTION public.add_volleyball_mark(player_name text, skill_level text DEFAULT 'iniciante'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active public.fila%ROWTYPE;
  v_marks_count int;
  v_confirmed_count int;
  v_is_waiting boolean;
  v_position int;
  v_new_id uuid;
  v_user_can_mark boolean := false;
BEGIN
  -- Verificar se há lugares confirmados disponíveis
  SELECT COUNT(*) INTO v_confirmed_count FROM public.volleyball_queue WHERE is_waiting = false;
  
  -- Se ainda há vagas nos 12 primeiros, verificar se é a vez do usuário
  IF v_confirmed_count < 12 THEN
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

    -- Verificar limite de 2 marcações por turno para os 12 primeiros
    SELECT COUNT(*) INTO v_marks_count
    FROM public.volleyball_queue q
    WHERE q.marked_by_user_id = auth.uid()
      AND q.marked_at >= COALESCE(v_active.iniciou_em, now());

    IF v_marks_count >= 2 THEN
      RAISE EXCEPTION 'Limite de 2 marcações por turno atingido.';
    END IF;
    
    v_user_can_mark := true;
  ELSE
    -- Após os 12 primeiros, qualquer pessoa pode marcar (lista de espera)
    v_user_can_mark := true;
  END IF;

  IF NOT v_user_can_mark THEN
    RAISE EXCEPTION 'Não é possível marcar neste momento.';
  END IF;

  -- Determinar posição e se vai para lista de espera
  v_is_waiting := v_confirmed_count >= 12;
  IF v_is_waiting THEN
    SELECT COUNT(*) + 1 INTO v_position FROM public.volleyball_queue WHERE is_waiting = true;
  ELSE
    v_position := v_confirmed_count + 1;
  END IF;

  -- Inserir o jogador
  INSERT INTO public.volleyball_queue (player_name, marked_by_user_id, position, is_waiting, skill_level)
  VALUES (player_name, auth.uid(), v_position, v_is_waiting, skill_level)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;