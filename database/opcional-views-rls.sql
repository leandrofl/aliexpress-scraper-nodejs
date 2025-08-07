-- OPCIONAL: Restringir views com RLS
-- Execute no SQL Editor do Supabase se quiser aplicar RLS às views

-- Ativar RLS nas views
ALTER VIEW vw_produtos_resumo SET (security_barrier = true);
ALTER VIEW vw_metricas_consolidadas SET (security_barrier = true);
ALTER VIEW vw_campanhas_performance SET (security_barrier = true);

-- Criar políticas para as views (se necessário no futuro)
-- CREATE POLICY "View products summary policy" ON vw_produtos_resumo
--   FOR SELECT USING (auth.uid() = tenant_id);

-- CREATE POLICY "View metrics policy" ON vw_metricas_consolidadas  
--   FOR SELECT USING (auth.uid() = tenant_id);

-- CREATE POLICY "View campaigns policy" ON vw_campanhas_performance
--   FOR SELECT USING (auth.uid() = tenant_id);
