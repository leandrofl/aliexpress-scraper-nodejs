# 🧪 AliExpress Scraper - Test Suite

Comprehensive testing framework for the AliExpress Scraper project with multiple test categories and methodologies.

## 📁 Test Structure

### 🔧 Core Tests (`core/`)
- **config-intelligent.test.js**: Configuration system validation

### 🔍 Exploratory Tests (`exploratory/`)
- **executive-summary-final.js**: Complete system integration tests
- **integrated-tests.js**: End-to-end workflow validation
- **margin-optimized-tests.js**: Margin calculation optimization tests
- **margin-tests.js**: Basic margin validation tests
- **teste-google-direto.js**: Direct Google Translate API tests
- **teste-google-translate-real.js**: Real translation workflow tests
- **teste-imghash-nova.js**: New image hash implementation tests
- **teste-ml-real.js**: Real Mercado Livre scraping tests
- **teste-sintaxe.js**: Syntax and code structure validation
- **teste-sistema-imagens-lote.js**: Batch image processing tests
- **teste-sistema-traducao.js**: Translation system integration tests
- **test-fallback-traducao.js**: Translation fallback mechanism tests

### 🔽 Filter Tests (`filters/`)
- **integrated-filters.test.js**: Combined filter system tests
- **qualitative.test.js**: Qualitative filter validation
- **quantitative.test.js**: Quantitative filter validation

### ✅ Validation Tests (`validation/`)
- **margin-validator.test.js**: Margin validation logic tests

## 🚀 Running Tests

### Quick Test Commands
```bash
# Run all tests
npm test

# Run specific test category
npm run test:core
npm run test:filters
npm run test:validation
npm run test:exploratory
```

### Manual Test Execution
```bash
# Individual test files
node unitTests/exploratory/teste-ml-real.js
node unitTests/validation/margin-validator.test.js
node unitTests/filters/quantitative.test.js
```

## 📊 Cobertura de Testes

### ✅ **Filtros Quantitativos**
- Produto com métricas excelentes
- Produto categoria específica (Casa e Cozinha)
- Produto com métricas baixas
- Sistema de score ponderado por categoria
- Casos extremos (valores nulos/vazios)

### ✅ **Filtros Qualitativos**
- Integração OpenAI (mock)
- Fallback para análise básica
- Análise de palavras-chave positivas
- Análise de palavras-chave negativas
- Análise de avaliações de clientes
- Casos extremos (dados incompletos)

### ✅ **Validação de Margem**
- Produto viável (margem > 15%)
- Produto com margem baixa
- Cálculo correto de impostos brasileiros (12%)
- Taxa de conversão USD/BRL (R$ 5.20)
- Cálculo de frete baseado em peso
- Taxa do marketplace (10%)
- Geração de dados de mercado
- Casos extremos

### ✅ **Filtros Integrados**
- Produto com alta qualidade geral
- Produto com qualidade média
- Produto com baixa qualidade
- Sistema de pesos (30% quantitativo, 30% qualitativo, 40% margem)
- Cálculo de aprovação final
- Integração completa de todos os filtros
- Tratamento de erros
- Consistência de resultados

## ⚙️ Configuração dos Testes

### Constantes de Teste
```javascript
// Valores mínimos para filtros quantitativos
MIN_SALES = 100
MIN_REVIEWS = 50  
MIN_RATING = 4.0
MIN_ORDERS = 100

// Configuração de margem brasileira
TAXA_USD_BRL = 5.20
IMPOSTO_IMPORTACAO = 12%
TAXA_MARKETPLACE = 10%
FRETE_BASE = R$ 12.00
MARGEM_MINIMA = 15%
```

### Dados de Teste
Os testes utilizam produtos fictícios mas realistas:
- **Smart Watch Premium**: Produto de alta qualidade tecnológica
- **Kitchen Knife Set**: Produto casa e cozinha com qualidade profissional  
- **Basic Phone Case**: Produto básico com métricas baixas

## 🎯 Critérios de Aprovação

### Score Ponderado
- **30%** Filtros Quantitativos (vendas, avaliações, nota)
- **30%** Filtros Qualitativos (IA + análise semântica)
- **40%** Validação de Margem (custos brasileiros reais)

### Limite de Aprovação
- **Score ≥ 70**: Produto aprovado
- **Score < 70**: Produto rejeitado
- **Margem ≥ 15%**: Viável para mercado brasileiro

## 🔍 Interpretação dos Resultados

### ✅ **Teste Passou**
- Implementação funcionando corretamente
- Lógica de negócio validada
- Cenário coberto adequadamente

### ❌ **Teste Falhou**
- Verificar implementação da função
- Revisar lógica de cálculo
- Analisar tratamento de casos extremos

## 🛠️ Manutenção

### Atualizando Testes
1. Modificar dados de teste conforme necessário
2. Ajustar critérios de aprovação se regras mudarem
3. Adicionar novos casos de teste para features novas

### Adicionando Novos Testes
1. Criar arquivo `.test.js` na pasta apropriada
2. Seguir padrão de nomenclatura e estrutura
3. Adicionar ao `test-runner.js` se necessário

## 📈 Métricas de Qualidade

### Taxa de Sucesso Esperada
- **Filtros Quantitativos**: 100% (lógica determinística)
- **Filtros Qualitativos**: 90% (dependente de IA/fallback)
- **Validação de Margem**: 100% (cálculos matemáticos)
- **Filtros Integrados**: 95% (coordenação entre sistemas)

### Performance
- Tempo execução individual: < 100ms
- Tempo suíte completa: < 2s
- Uso de memória: < 50MB

---

> **💡 Dica**: Execute `node unitTests/test-simple.js` primeiro para verificar se o ambiente está configurado corretamente antes de rodar a suíte completa.
