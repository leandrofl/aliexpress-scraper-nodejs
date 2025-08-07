-- SCHEMA MÍNIMO PARA TESTE INICIAL
-- Copie e cole este SQL no SQL Editor do Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_aliexpress text UNIQUE NOT NULL,
  nome text NOT NULL,
  categoria text NOT NULL,
  preco_aliexpress numeric(10,2),
  url_aliexpress text,
  descricao text,
  url_imagem text,
  avaliacoes integer DEFAULT 0,
  rating numeric(2,1) DEFAULT 0,
  vendidos integer DEFAULT 0,
  shipping_info text,
  dados_ml jsonb,
  metricas_qualidade jsonb,
  score_total integer DEFAULT 0,
  score_categoria text DEFAULT 'bronze',
  status text DEFAULT 'novo',
  -- Novos campos para fallback textual (sugestão ChatGPT)
  imagem_comparada boolean DEFAULT true,
  fonte_de_verificacao text DEFAULT 'imagem' CHECK (fonte_de_verificacao IN ('imagem', 'texto', 'erro')),
  risco_imagem boolean DEFAULT false,
  compatibilidade_textual jsonb,
  ratio_preco numeric(5,2),
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Tabela de métricas
CREATE TABLE IF NOT EXISTS metricas_scraping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  total_produtos integer DEFAULT 0,
  produtos_salvos integer DEFAULT 0,
  produtos_duplicados integer DEFAULT 0,
  tempo_execucao integer DEFAULT 0,
  taxa_sucesso numeric(5,2) DEFAULT 0,
  configuracao_usada jsonb,
  criado_em timestamptz DEFAULT now()
);

-- Tabela de campanhas (para futuro)
CREATE TABLE IF NOT EXISTS campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  configuracao jsonb,
  status text DEFAULT 'ativa',
  criado_em timestamptz DEFAULT now()
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_score ON produtos(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_produtos_criado ON produtos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_metricas_categoria ON metricas_scraping(categoria);
CREATE INDEX IF NOT EXISTS idx_metricas_criado ON metricas_scraping(criado_em DESC);
