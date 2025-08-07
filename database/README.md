# 🗄️ Guia Completo - Integração com Supabase

## 📋 Visão Geral

Este documento descreve como configurar e usar a integração com o banco de dados Supabase para persistir dados do scraper AliExpress.

## 🚀 Setup Inicial

### 1. Criar Conta no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma conta gratuita
3. Crie um novo projeto
4. Anote a URL e a chave pública do projeto

### 2. Configurar Variáveis de Ambiente

```bash
# Edite o arquivo .env existente com suas credenciais
# Adicione as linhas do Supabase:
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-chave-publica-aqui
```

### 3. Criar Estrutura do Banco

1. Acesse o Supabase Dashboard
2. Vá para "SQL Editor"
3. Execute o conteúdo do arquivo `database/schema.sql`
4. Verifique se as tabelas foram criadas

### 4. Testar Configuração

```bash
# Execute o script de setup
node database/setup-database.js
```

## 🏗️ Estrutura do Banco

### Tabelas Principais

#### `produtos`
Armazena todos os produtos raspados:
- `id`: Chave primária UUID
- `product_id_aliexpress`: ID único do produto no AliExpress
- `nome`: Nome do produto
- `categoria`: Categoria do produto
- `preco_aliexpress`: Preço original
- `score_total`: Pontuação calculada (0-100)
- `score_categoria`: Categoria da pontuação (bronze/prata/ouro/diamante)
- `dados_ml`: Dados do top 3 similar via Machine Learning
- `metricas_qualidade`: Métricas de qualidade do produto
- `status`: Status do produto (novo/atualizado/removido)

#### `metricas_scraping`
Registra métricas de cada sessão:
- `id`: Chave primária UUID
- `categoria`: Categoria processada
- `total_produtos`: Total de produtos encontrados
- `produtos_salvos`: Produtos efetivamente salvos
- `produtos_duplicados`: Produtos duplicados ignorados
- `tempo_execucao`: Tempo total de execução
- `taxa_sucesso`: Taxa de sucesso da sessão

#### `campanhas`
Para futuras funcionalidades SaaS:
- `id`: Chave primária UUID
- `nome`: Nome da campanha
- `configuracao`: Configurações da campanha
- `status`: Status da campanha

### Views Otimizadas

#### `vw_produtos_resumo`
Visão resumida dos produtos com estatísticas:
```sql
SELECT * FROM vw_produtos_resumo;
```

#### `vw_metricas_diarias`
Métricas agrupadas por dia:
```sql
SELECT * FROM vw_metricas_diarias ORDER BY data DESC;
```

## 🔧 Uso da API

### Importar Funções

```javascript
import {
    salvarProdutoCompleto,
    salvarMetricasSessao,
    verificarDuplicidadeDB,
    obterProdutosPorCategoria,
    obterEstatisticasGerais
} from './database/database-integration.js';
```

### Salvar Produto

```javascript
const produto = {
    product_id_aliexpress: 'ali_123456',
    nome: 'Smartphone Android',
    categoria: 'Eletrônicos',
    preco_aliexpress: 299.90,
    score_total: 85,
    score_categoria: 'ouro',
    dados_ml: { top1: 'iPhone 12', similaridade: 0.87 },
    metricas_qualidade: { reviews: 1500, rating: 4.5 }
};

const resultado = await salvarProdutoCompleto(produto);
console.log(resultado.sucesso ? 'Salvo!' : 'Erro:', resultado.erro);
```

### Verificar Duplicatas

```javascript
const ehDuplicata = await verificarDuplicidadeDB('ali_123456');
if (ehDuplicata) {
    console.log('Produto já existe no banco');
}
```

### Salvar Métricas de Sessão

```javascript
const metricas = {
    categoria: 'Eletrônicos',
    total_produtos: 100,
    produtos_salvos: 95,
    produtos_duplicados: 5,
    tempo_execucao: 1800, // segundos
    taxa_sucesso: 95.0
};

await salvarMetricasSessao(metricas);
```

### Obter Produtos por Categoria

```javascript
const produtos = await obterProdutosPorCategoria('Eletrônicos', 10);
produtos.forEach(p => {
    console.log(`${p.nome} - Score: ${p.score_total}`);
});
```

### Obter Estatísticas Gerais

```javascript
const stats = await obterEstatisticasGerais();
console.log(`Total produtos: ${stats.totalProdutos}`);
console.log(`Categoria com mais produtos: ${stats.categoriaMaisPopular}`);
console.log(`Score médio: ${stats.scoreMedia}`);
```

## 📊 Queries Úteis

### Top 10 Produtos por Score

```sql
SELECT nome, categoria, preco_aliexpress, score_total, score_categoria
FROM produtos 
ORDER BY score_total DESC 
LIMIT 10;
```

### Produtos por Categoria

```sql
SELECT categoria, COUNT(*) as total, AVG(score_total) as score_medio
FROM produtos 
GROUP BY categoria 
ORDER BY total DESC;
```

### Métricas de Performance

```sql
SELECT 
    DATE(criado_em) as data,
    SUM(total_produtos) as produtos_processados,
    SUM(produtos_salvos) as produtos_salvos,
    AVG(taxa_sucesso) as taxa_sucesso_media
FROM metricas_scraping 
GROUP BY DATE(criado_em) 
ORDER BY data DESC;
```

### Produtos Duplicados Recentes

```sql
SELECT product_id_aliexpress, COUNT(*) as duplicatas
FROM produtos 
GROUP BY product_id_aliexpress 
HAVING COUNT(*) > 1
ORDER BY duplicatas DESC;
```

## 🔒 Segurança

### Row Level Security (RLS)

As tabelas têm políticas de segurança configuradas:
- Apenas usuários autenticados podem acessar dados
- Isolamento por tenant (futuro)
- Logs de auditoria automáticos

### Backup e Recovery

```sql
-- Backup de produtos
COPY produtos TO '/backup/produtos.csv' CSV HEADER;

-- Backup de métricas
COPY metricas_scraping TO '/backup/metricas.csv' CSV HEADER;
```

## 🚨 Troubleshooting

### Erro de Conexão

1. Verifique as credenciais no `.env`
2. Confirme se o projeto Supabase está ativo
3. Teste conexão no Dashboard do Supabase

### Erro de Permissão

1. Verifique as políticas RLS
2. Confirme se a chave tem permissões adequadas
3. Teste com anon key primeiro

### Performance Lenta

1. Verifique os índices das tabelas
2. Use paginação para consultas grandes
3. Otimize queries com EXPLAIN

### Dados Inconsistentes

1. Execute script de validação:
```sql
-- Verificar produtos sem score
SELECT * FROM produtos WHERE score_total IS NULL;

-- Verificar métricas órfãs
SELECT * FROM metricas_scraping WHERE categoria NOT IN (SELECT DISTINCT categoria FROM produtos);
```

## 📈 Monitoramento

### Dashboard do Supabase

Acesse métricas em tempo real:
- Conexões ativas
- Queries por minuto
- Tamanho do banco
- Performance de queries

### Logs Customizados

```javascript
// Habilitar logs detalhados
process.env.DB_DEBUG_LOGS = 'true';

// Logs aparecerão no console durante operações
```

## 🔄 Manutenção

### Limpeza de Dados Antigos

```sql
-- Remover produtos mais antigos que 30 dias
DELETE FROM produtos 
WHERE criado_em < NOW() - INTERVAL '30 days';

-- Remover métricas antigas
DELETE FROM metricas_scraping 
WHERE criado_em < NOW() - INTERVAL '90 days';
```

### Otimização de Índices

```sql
-- Reindexar tabelas grandes
REINDEX TABLE produtos;
REINDEX TABLE metricas_scraping;

-- Análise de estatísticas
ANALYZE produtos;
ANALYZE metricas_scraping;
```

## 🎯 Próximos Passos

1. **Implementar Cache**: Redis para consultas frequentes
2. **API REST**: Endpoint para consulta externa
3. **Dashboard Web**: Interface para visualização
4. **Alertas**: Notificações para anomalias
5. **ML Integration**: Análise preditiva de tendências

---

Para suporte, consulte:
- [Documentação Supabase](https://supabase.com/docs)
- [GitHub Issues](https://github.com/seu-usuario/aliexpress-scraper/issues)
- Email: suporte@seuprojeto.com
