-- ================================================================================================
-- MIGRAÇÃO DO SCHEMA SEMÂNTICO PARA ANÁLISE APRIMORADA DE PRODUTOS  
-- ================================================================================================
-- Script para adicionar campos de análise semântica à tabela produtos
-- Execute todos os comandos abaixo no SQL Editor do Supabase Dashboard
-- 
-- Funcionalidades adicionadas:
-- ✅ Análise semântica com BERT multilingual 
-- ✅ Cálculo de preço médio do Mercado Livre
-- ✅ Desvio percentual de preços
-- ✅ Score de compatibilidade semântica (0-100%)
-- ✅ Método de análise utilizado (imagem/semântico/textual)
-- ✅ Sistema de fallback textual
-- ✅ Comentários de análise semântica
-- ================================================================================================

-- 1. Adicionar campo para preço médio do Mercado Livre
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_medio_ml DECIMAL(10,2);

-- 2. Adicionar campo para desvio percentual de preço
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS desvio_preco DECIMAL(5,2);

-- 3. Adicionar campo para score de compatibilidade semântica (0-100%)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS score_semantico INTEGER CHECK (score_semantico BETWEEN 0 AND 100);

-- 4. Adicionar campo para método de análise utilizado
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS metodo_analise_titulo VARCHAR(50) 
CHECK (metodo_analise_titulo IN ('imagem', 'semantico', 'textual_fallback'));

-- 5. Adicionar flag para indicar se foi aprovado pelo fallback textual
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS aprovado_fallback_texto BOOLEAN DEFAULT FALSE;

-- 6. Adicionar campo para comentários da análise semântica
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS comentario_semantico TEXT;

-- ================================================================================================
-- COMENTÁRIOS SOBRE OS NOVOS CAMPOS:
-- ================================================================================================
-- 
-- preco_medio_ml: 
--   Preço médio calculado dos top 3 produtos similares no Mercado Livre
--   Usado para validação de preços e detecção de oportunidades
-- 
-- desvio_preco:
--   Percentual de diferença entre preço AliExpress e preço médio ML
--   Exemplo: 200% indica que ML está 3x mais caro que AliExpress
-- 
-- score_semantico:
--   Score de 0-100% indicando compatibilidade semântica dos títulos
--   Baseado em modelo BERT multilingual para comparação offline
-- 
-- metodo_analise_titulo:
--   'imagem': Comparação por análise de imagens (método principal)
--   'semantico': Análise semântica com BERT (fallback inteligente)  
--   'textual_fallback': Comparação textual simples (último recurso)
-- 
-- aprovado_fallback_texto:
--   TRUE se produto foi aprovado usando análise textual simples
--   Útil para auditoria e controle de qualidade
-- 
-- comentario_semantico:
--   Campo livre para observações sobre a análise semântica
--   Inclui detalhes da compatibilidade e motivos de aprovação/rejeição
-- 
-- ================================================================================================
-- PRÓXIMOS PASSOS:
-- ================================================================================================
-- 
-- 1. Execute todos os comandos ALTER TABLE acima
-- 2. Verifique se as colunas foram criadas: SELECT * FROM produtos LIMIT 1;
-- 3. Execute: npm run test:semantico (para testar o sistema)
-- 4. Execute: npm start (para rodar o scraper com análise semântica)
-- 
-- ================================================================================================
