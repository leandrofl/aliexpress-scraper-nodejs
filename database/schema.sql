-- ===============================================
-- ESTRUTURA COMPLETA DO BANCO DE DADOS SUPABASE
-- LoopStore - Sistema de Scraping AliExpress
-- ===============================================

-- ✅ EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================
-- 📦 TABELA PRINCIPAL: PRODUTOS
-- ===============================================

CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_aliexpress text UNIQUE NOT NULL, -- ID original do AliExpress
  tenant_id uuid REFERENCES auth.users(id), -- Multi-tenant SaaS
  
  -- 📋 Dados básicos
  nome text NOT NULL,
  nome_traduzido text,
  categoria text NOT NULL,
  preco_aliexpress numeric(10,2),
  url_aliexpress text,
  
  -- 🎯 Dados de análise (melhorias implementadas!)
  score_total integer DEFAULT 0 CHECK (score_total >= 0 AND score_total <= 100),
  score_categoria text DEFAULT 'bronze' CHECK (score_categoria IN ('bronze', 'prata', 'ouro', 'diamante')),
  aprovado_quantitativo boolean DEFAULT false,
  aprovado_qualitativo boolean DEFAULT false,
  aprovado_final boolean DEFAULT false,
  
  -- 🛒 Dados Mercado Livre
  preco_ml_medio numeric(10,2),
  /*
  ml_top3_produtos formato esperado:
  [
    {"nome": "Produto 1", "preco": 89.90, "url": "https://...", "similaridade": 0.85},
    {"nome": "Produto 2", "preco": 92.50, "url": "https://...", "similaridade": 0.78},
    {"nome": "Produto 3", "preco": 87.30, "url": "https://...", "similaridade": 0.72}
  ]
  */
  ml_top3_produtos jsonb,
  similaridade_visual numeric(3,2) CHECK (similaridade_visual >= 0 AND similaridade_visual <= 1),
  
  -- 📊 Métricas de qualidade
  vendas_aliexpress integer DEFAULT 0,
  rating_aliexpress numeric(2,1) CHECK (rating_aliexpress >= 0 AND rating_aliexpress <= 5),
  reviews_aliexpress integer DEFAULT 0,
  peso text,
  frete_info jsonb, -- Informações detalhadas de frete
  
  -- 🏪 Dados do vendedor
  vendedor_nome text,
  vendedor_rating numeric(3,2),
  vendedor_tempo_abertura text,
  
  -- 🔍 Status e controle (implementando sugestão do ChatGPT)
  status text DEFAULT 'coletado' CHECK (status IN ('coletado', 'analisado', 'testado', 'aprovado', 'listado', 'reprovado')),
  hash_duplicidade text UNIQUE, -- Sistema anti-duplicidade
  
  -- 🎯 Campos de fallback textual e controle de qualidade (ChatGPT + Copilot)
  imagem_comparada boolean DEFAULT true,
  fonte_de_verificacao text DEFAULT 'imagem' CHECK (fonte_de_verificacao IN ('imagem', 'texto', 'erro')),
  risco_imagem boolean DEFAULT false,
  compatibilidade_textual jsonb, -- Dados da análise de compatibilidade textual
  ratio_preco numeric(5,2), -- Razão entre preço ML e AliExpress
  
  -- 🔍 Campos de análise avançada (Sugestões ChatGPT)
  metodo_validacao_margem text DEFAULT 'nenhum' CHECK (metodo_validacao_margem IN ('imagem', 'texto', 'nenhum')),
  score_imagem integer DEFAULT 0 CHECK (score_imagem >= 0 AND score_imagem <= 100),
  imagem_match boolean DEFAULT false,
  imagem_erro text, -- 'timeout', '404', 'hash_divergente', etc.
  score_texto integer DEFAULT 0 CHECK (score_texto >= 0 AND score_texto <= 100),
  match_por_texto boolean DEFAULT false,
  risco_final integer DEFAULT 0 CHECK (risco_final >= 0 AND risco_final <= 100),
  pendente_revisao boolean DEFAULT false,
  
  -- 🛒 Dados detalhados Mercado Livre
  preco_mercado_livre numeric(10,2),
  link_produto_ml text,
  imagem_ml text,
  fonte_imagem_ml text DEFAULT 'ml',
  termos_busca_ml text,
  
  -- 💰 Análise financeira detalhada
  preco_ali_usd numeric(10,2),
  preco_ali_brl numeric(10,2),
  frete_ali_brl numeric(10,2) DEFAULT 0,
  preco_total_ali_brl numeric(10,2),
  margem_lucro_rs numeric(10,2),
  moeda_referencia text DEFAULT 'BRL' CHECK (moeda_referencia IN ('USD', 'BRL')),
  
  -- ⏰ Timestamps
  primeira_coleta_em timestamptz DEFAULT now(),
  ultima_analise_em timestamptz DEFAULT now(),
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ===============================================
-- 📈 TABELA: MÉTRICAS DE SCRAPING
-- ===============================================

CREATE TABLE IF NOT EXISTS metricas_scraping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id),
  sessao_id text NOT NULL,
  categoria text NOT NULL,
  
  -- 📊 Estatísticas da sessão
  produtos_coletados integer DEFAULT 0,
  produtos_processados integer DEFAULT 0,
  produtos_aprovados integer DEFAULT 0,
  produtos_duplicados integer DEFAULT 0,
  
  -- ⏱ Métricas de tempo
  duracao_total_ms integer,
  tempo_medio_produto_ms integer,
  
  -- 📈 Taxas de sucesso
  taxa_aprovacao_quantitativa numeric(5,2), -- Percentual 0-100
  taxa_aprovacao_qualitativa numeric(5,2), -- Percentual 0-100
  taxa_aprovacao_final numeric(5,2), -- Percentual 0-100
  
  -- 🛒 Dados Mercado Livre
  buscas_ml_realizadas integer DEFAULT 0,
  produtos_ml_encontrados integer DEFAULT 0,
  erros_ml integer DEFAULT 0,
  tempo_medio_busca_ml_ms integer,
  
  -- 🎯 Distribuição de scores
  produtos_bronze integer DEFAULT 0,
  produtos_prata integer DEFAULT 0,
  produtos_ouro integer DEFAULT 0,
  produtos_diamante integer DEFAULT 0,
  
  -- 📋 Configurações da sessão
  config_max_produtos integer,
  config_max_paginas integer,
  config_target_final integer,
  
  criado_em timestamptz DEFAULT now()
);

-- ===============================================
-- 🚀 TABELA: CAMPANHAS (SaaS futuro)
-- ===============================================

CREATE TABLE IF NOT EXISTS campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id),
  produto_id uuid REFERENCES produtos(id) ON DELETE CASCADE,
  
  -- 📋 Dados da campanha
  nome text NOT NULL,
  plataforma text NOT NULL CHECK (plataforma IN ('facebook', 'google', 'tiktok', 'instagram', 'youtube')),
  tipo_campanha text DEFAULT 'conversao' CHECK (tipo_campanha IN ('conversao', 'trafego', 'engajamento', 'video_views')),
  
  -- 🎨 Criativos
  criativo_url text,
  criativo_tipo text CHECK (criativo_tipo IN ('imagem', 'video', 'carrossel')),
  copy_anuncio text,
  
  -- 💰 Investimento e performance
  orcamento_diario numeric(10,2) DEFAULT 0,
  investimento_total numeric(10,2) DEFAULT 0,
  vendas integer DEFAULT 0,
  receita numeric(10,2) DEFAULT 0,
  roas numeric(5,2) DEFAULT 0, -- Return on Ad Spend
  cpm numeric(8,2) DEFAULT 0, -- Custo por mil impressões
  cpc numeric(8,2) DEFAULT 0, -- Custo por clique
  ctr numeric(5,2) DEFAULT 0, -- Click Through Rate %
  
  -- 📊 Métricas de engajamento
  impressoes integer DEFAULT 0,
  cliques integer DEFAULT 0,
  conversoes integer DEFAULT 0,
  
  -- 🎯 Status
  status text DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'finalizada')),
  data_inicio timestamptz,
  data_fim timestamptz,
  
  -- ⏰ Timestamps
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ===============================================
-- 🔐 ROW LEVEL SECURITY (RLS)
-- ===============================================

-- Ativar RLS em todas as tabelas
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_scraping ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança: usuários só veem seus próprios dados
CREATE POLICY "Users can manage own products" ON produtos
  FOR ALL USING (auth.uid() = tenant_id);

CREATE POLICY "Users can manage own metrics" ON metricas_scraping
  FOR ALL USING (auth.uid() = tenant_id);

CREATE POLICY "Users can manage own campaigns" ON campanhas
  FOR ALL USING (auth.uid() = tenant_id);

-- ===============================================
-- ⚡ ÍNDICES PARA PERFORMANCE
-- ===============================================

-- Índices principais para produtos
CREATE INDEX IF NOT EXISTS idx_produtos_tenant_categoria ON produtos(tenant_id, categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_score_status ON produtos(score_total DESC, status);
CREATE INDEX IF NOT EXISTS idx_produtos_aprovado_final ON produtos(aprovado_final, tenant_id) WHERE aprovado_final = true;
CREATE INDEX IF NOT EXISTS idx_produtos_hash_duplicidade ON produtos(hash_duplicidade) WHERE hash_duplicidade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_product_id ON produtos(product_id_aliexpress);

-- Índices para métricas
CREATE INDEX IF NOT EXISTS idx_metricas_tenant_data ON metricas_scraping(tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_categoria ON metricas_scraping(categoria, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_sessao ON metricas_scraping(sessao_id);

-- Índices para campanhas
CREATE INDEX IF NOT EXISTS idx_campanhas_tenant_status ON campanhas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campanhas_produto ON campanhas(produto_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_plataforma ON campanhas(plataforma, status);

-- ===============================================
-- 🔄 TRIGGERS PARA AUTOMAÇÃO
-- ===============================================

-- Função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_atualizado_em_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar automaticamente atualizado_em
CREATE TRIGGER update_produtos_atualizado_em 
    BEFORE UPDATE ON produtos 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_atualizado_em_column();

CREATE TRIGGER update_campanhas_atualizado_em 
    BEFORE UPDATE ON campanhas 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_atualizado_em_column();

-- ===============================================
-- 📊 VIEWS ÚTEIS PARA RELATÓRIOS
-- ===============================================

-- View: Resumo de produtos por categoria e status
CREATE OR REPLACE VIEW vw_produtos_resumo AS
SELECT 
    tenant_id,
    categoria,
    status,
    score_categoria,
    COUNT(*) as total_produtos,
    AVG(score_total) as score_medio,
    AVG(preco_aliexpress) as preco_medio,
    COUNT(*) FILTER (WHERE aprovado_final = true) as aprovados,
    COUNT(*) FILTER (WHERE ml_top3_produtos IS NOT NULL) as com_dados_ml
FROM produtos 
GROUP BY tenant_id, categoria, status, score_categoria;

-- View: Métricas consolidadas por tenant
CREATE OR REPLACE VIEW vw_metricas_consolidadas AS
SELECT 
    tenant_id,
    categoria,
    COUNT(*) as total_sessoes,
    SUM(produtos_processados) as total_produtos_processados,
    SUM(produtos_aprovados) as total_produtos_aprovados,
    AVG(taxa_aprovacao_final) as taxa_aprovacao_media,
    AVG(duracao_total_ms) as tempo_medio_sessao_ms,
    MAX(criado_em) as ultima_sessao
FROM metricas_scraping 
GROUP BY tenant_id, categoria;

-- View: Performance de campanhas
CREATE OR REPLACE VIEW vw_campanhas_performance AS
SELECT 
    c.tenant_id,
    c.plataforma,
    c.status,
    COUNT(*) as total_campanhas,
    AVG(c.roas) as roas_medio,
    SUM(c.investimento_total) as investimento_total,
    SUM(c.receita) as receita_total,
    AVG(c.ctr) as ctr_medio,
    p.categoria as categoria_produto
FROM campanhas c
LEFT JOIN produtos p ON c.produto_id = p.id
GROUP BY c.tenant_id, c.plataforma, c.status, p.categoria;

-- View: Produtos com risco de imagem (implementando sugestão ChatGPT)
CREATE OR REPLACE VIEW vw_produtos_risco_imagem AS
SELECT 
    tenant_id,
    nome,
    categoria,
    preco_aliexpress,
    score_total,
    fonte_de_verificacao,
    risco_imagem,
    compatibilidade_textual,
    ratio_preco,
    dados_ml,
    criado_em,
    status
FROM produtos 
WHERE risco_imagem = true OR fonte_de_verificacao = 'texto'
ORDER BY score_total DESC, criado_em DESC;

-- ===============================================
-- 🧪 DADOS DE TESTE (OPCIONAL)
-- ===============================================

-- Inserir dados de exemplo para teste (descomente se necessário)
/*
INSERT INTO produtos (
    product_id_aliexpress, 
    nome, 
    categoria, 
    preco_aliexpress, 
    score_total, 
    score_categoria,
    aprovado_final,
    status
) VALUES 
(
    '1005001234567890', 
    'Produto Teste 1', 
    'Casa e Cozinha', 
    29.90, 
    85, 
    'diamante',
    true,
    'aprovado'
),
(
    '1005009876543210', 
    'Produto Teste 2', 
    'Tecnologia', 
    59.90, 
    72, 
    'ouro',
    true,
    'listado'
);
*/

-- ===============================================
-- ✅ ESTRUTURA CRIADA COM SUCESSO!
-- ===============================================

-- Para verificar se tudo foi criado corretamente:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
