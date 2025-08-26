-- Fix all ambiguous column references
CREATE OR REPLACE FUNCTION public.advance_fila_with_offline_check()
RETURNS TABLE (
  id uuid,
  usuario_id uuid,
  nome_usuario text,
  ordem integer,
  iniciou_em timestamptz,
  concluiu_em timestamptz,
  status public.fila_status,
  remaining_seconds integer,
  was_advanced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active public.fila%ROWTYPE;
  v_user_online boolean;
  v_was_advanced boolean := false;
BEGIN
  -- Mark offline users first
  PERFORM public.mark_offline_users();

  -- Get current active user
  SELECT * INTO v_active FROM public.fila f WHERE f.status = 'ativo' ORDER BY f.iniciou_em DESC LIMIT 1;

  IF v_active.id IS NOT NULL THEN
    -- Check if active user is online
    SELECT COALESCE(up.is_online, false) INTO v_user_online
    FROM public.user_presence up
    WHERE up.user_id = v_active.usuario_id;

    -- Force advance if: time expired (>60s) OR user is offline
    IF (v_active.iniciou_em IS NOT NULL AND (now() - v_active.iniciou_em) > interval '60 seconds')
       OR v_user_online = false THEN
      
      UPDATE public.fila f SET f.status = 'finalizado', f.concluiu_em = now() WHERE f.id = v_active.id;
      v_was_advanced := true;
    END IF;
  END IF;

  -- Ensure we have one active (skip offline users)
  IF NOT EXISTS (SELECT 1 FROM public.fila f WHERE f.status = 'ativo') THEN
    -- Find next online user in pending status
    UPDATE public.fila f
    SET f.status = 'ativo', f.iniciou_em = now()
    WHERE f.id = (
      SELECT f2.id FROM public.fila f2
      LEFT JOIN public.user_presence up ON f2.usuario_id = up.user_id
      WHERE f2.status = 'pendente' 
        AND COALESCE(up.is_online, false) = true
      ORDER BY f2.ordem 
      LIMIT 1
    );
    
    -- If no online users, take the next pending anyway
    IF NOT EXISTS (SELECT 1 FROM public.fila f WHERE f.status = 'ativo') THEN
      UPDATE public.fila f
      SET f.status = 'ativo', f.iniciou_em = now()
      WHERE f.id = (
        SELECT f2.id FROM public.fila f2 WHERE f2.status = 'pendente' ORDER BY f2.ordem LIMIT 1
      );
    END IF;
  END IF;

  -- Return active with remaining seconds
  RETURN QUERY
  SELECT f.id, f.usuario_id, f.nome_usuario, f.ordem, f.iniciou_em, f.concluiu_em, f.status,
    CASE 
      WHEN f.iniciou_em IS NULL THEN NULL
      ELSE GREATEST(0, 60 - FLOOR(EXTRACT(EPOCH FROM (now() - f.iniciou_em)))::int)
    END AS remaining_seconds,
    v_was_advanced
  FROM public.fila f
  WHERE f.status = 'ativo'
  ORDER BY f.iniciou_em DESC
  LIMIT 1;
END;
$$;