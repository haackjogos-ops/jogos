-- Verificar quantos minutos Pedro está ativo
SELECT nome_usuario, 
       EXTRACT(EPOCH FROM (now() - iniciou_em))/60 as minutos_ativo,
       status
FROM public.fila 
WHERE status = 'ativo';

-- Forçar avanço porque Pedro está offline (sem heartbeat)
UPDATE public.fila 
SET status = 'finalizado', concluiu_em = now() 
WHERE usuario_id = '0893678b-518d-4871-88a0-20e78df23518' AND status = 'ativo';

-- Ativar próximo usuário online (ou qualquer um se nenhum estiver online)
UPDATE public.fila 
SET status = 'ativo', iniciou_em = now()
WHERE id = (
  SELECT f.id FROM public.fila f
  LEFT JOIN public.user_presence up ON f.usuario_id = up.user_id
  WHERE f.status = 'pendente' 
    AND COALESCE(up.is_online, false) = true
  ORDER BY f.ordem 
  LIMIT 1
);

-- Se nenhum online, ativar o próximo da fila
UPDATE public.fila 
SET status = 'ativo', iniciou_em = now()
WHERE id = (
  SELECT id FROM public.fila 
  WHERE status = 'pendente' 
  ORDER BY ordem 
  LIMIT 1
) AND NOT EXISTS (SELECT 1 FROM public.fila WHERE status = 'ativo');