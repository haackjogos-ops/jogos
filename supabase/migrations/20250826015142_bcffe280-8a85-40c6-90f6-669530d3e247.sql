-- Simple manual advance - mark current as finished and activate next
UPDATE public.fila 
SET status = 'finalizado', concluiu_em = now() 
WHERE status = 'ativo' AND iniciou_em < (now() - interval '60 seconds');

-- Activate next pending user
UPDATE public.fila 
SET status = 'ativo', iniciou_em = now()
WHERE id = (
  SELECT id FROM public.fila 
  WHERE status = 'pendente' 
  ORDER BY ordem 
  LIMIT 1
) AND NOT EXISTS (SELECT 1 FROM public.fila WHERE status = 'ativo');