-- Execute the advance function to force progression
DO $$
DECLARE
    result_record RECORD;
BEGIN
    FOR result_record IN SELECT * FROM public.advance_fila_with_offline_check()
    LOOP
        RAISE NOTICE 'Advanced fila: user=%, remaining_seconds=%, was_advanced=%', 
            result_record.nome_usuario, 
            result_record.remaining_seconds, 
            result_record.was_advanced;
    END LOOP;
END $$;