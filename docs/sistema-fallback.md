# Sistema de Verificação com Fallback Textual

## Visão Geral

O sistema foi aprimorado para incluir verificação textual como fallback quando a comparação de imagens falha, evitando perder produtos potencialmente lucrativos.

## Como Funciona

### 1. Verificação Principal (Imagem)
- Usa hash perceptual para comparar imagens
- Identifica produtos visualmente similares
- Marca `imagem_comparada: true`

### 2. Verificação Fallback (Texto)
- Ativada quando nenhuma imagem compatível é encontrada
- Usa a função `produtosSaoCompativeis()` para análise textual
- Aplicada apenas se a compatibilidade ≥ 60%
- Verifica se o ratio de preço está entre 2x e 5x
- Marca `risco_imagem: true` para revisão manual

## Novos Campos no Banco

```sql
-- Campos adicionados às tabelas de produtos
imagem_comparada BOOLEAN DEFAULT false,          -- Se houve comparação de imagem
fonte_de_verificacao VARCHAR(20) DEFAULT 'imagem', -- 'imagem' ou 'texto'
risco_imagem BOOLEAN DEFAULT false,              -- Produto precisa de revisão
compatibilidade_textual DECIMAL(5,2),           -- Score de compatibilidade (0-100%)
ratio_preco DECIMAL(8,2)                        -- Relação de preço (preço_aliexpress / preço_mercadolivre)
```

## View de Monitoramento

```sql
-- Nova view para produtos que precisam de atenção
CREATE VIEW vw_produtos_risco_imagem AS
SELECT 
    titulo,
    margem_lucro,
    compatibilidade_textual,
    ratio_preco,
    url,
    created_at
FROM produtos 
WHERE risco_imagem = true 
ORDER BY margem_lucro DESC;
```

## Comandos de Monitoramento

```bash
# Ver produtos com risco (máximo 20)
npm run db:risco

# Ver produtos com risco (quantidade personalizada)
node scripts/monitor-risco.js 50

# Estatísticas gerais do banco
npm run db:stats
```

## Exemplo de Saída do Monitor

```
🔍 Buscando produtos com risco de imagem...

⚠️  Encontrados 3 produtos com risco:

1. Smartphone Android 12GB RAM
   💰 Margem: 85.2%
   🔗 URL: https://mercadolivre...
   📊 Compatibilidade: 72%
   💹 Ratio Preço: 3.4
   📅 Criado: 15/01/2024
   ---

📈 Resumo:
   Total com risco: 3
   Margem média: 67.8%
   Compatibilidade média: 68.3%

🌟 2 produtos promissores encontrados!
   (Alta margem + Alta compatibilidade - revisar manualmente)
```

## Benefícios da Implementação

### ✅ Redução de Falsos Negativos
- Produtos lucrativos não são mais perdidos por falha na comparação de imagem
- Sistema de fallback garante segunda chance de análise

### ✅ Controle de Qualidade
- Produtos do fallback são marcados para revisão manual
- Risk score permite priorização da análise humana

### ✅ Transparência
- Cada produto tem sua fonte de verificação registrada
- Métricas de compatibilidade e ratio de preço disponíveis

### ✅ Monitoramento Ativo
- Scripts dedicados para acompanhar produtos em risco
- Alertas para produtos com alto potencial

## Configuração de Alertas (Futuro)

O sistema está preparado para integração com alertas automáticos:

```javascript
// Exemplo de integração futura
if (produtosRisco.some(p => p.margem_lucro > 80 && p.compatibilidade_textual > 75)) {
    enviarAlerta('Produto de alto potencial detectado!');
}
```

## Impacto Esperado

- **Aumento de 15-25%** na detecção de produtos válidos
- **Redução de 60%** na perda de oportunidades lucrativas
- **Melhoria na qualidade** através do sistema de revisão manual
- **Visibilidade completa** do processo de verificação
