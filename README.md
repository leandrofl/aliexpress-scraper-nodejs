
# � AliExpress Scraper - Sistema Completo de Análise de Produtos

Sistema avançado de mineração de dados do AliExpress com validação inteligente de margem de lucro no Mercado Livre brasileiro.

## ✨ Principais Funcionalidades

- 🕷️ **Web Scraping Stealth**: Puppeteer Extra com evasão de detecção
- 🔍 **Comparação Visual**: Hash perceptual para matching de produtos
- 🌍 **Tradução Inteligente**: Google Translate API para termos de busca
- 📊 **Validação de Margem**: Análise real de preços do Mercado Livre
- 🛡️ **Filtros Avançados**: Quantitativos, qualitativos e análise de risco
- 📈 **Exportação Excel**: Relatórios completos via ExcelJS
- 🎯 **ML Search**: Busca otimizada com axios/cheerio

## 🏗️ Arquitetura do Sistema

```
📁 Project Structure
├── 📁 scraper/           # Core scraping engine
├── 📁 filters/           # Product filtering system
├── 📁 marginValidation/  # ML price validation
├── 📁 database/          # 🆕 Supabase integration & schemas
├── 📁 utils/             # Image comparison & translation
├── 📁 unitTests/         # Comprehensive test suite
└── 📁 docs/              # Project documentation
```

## 🆕 **Database Integration**

Sistema completo de persistência com **Supabase PostgreSQL**:

- 💾 **Salvamento automático** de todos os produtos
- 📊 **Métricas detalhadas** de cada sessão
- 🔍 **Verificação de duplicidade** no banco
- 📈 **Dashboard em tempo real** via Supabase
- 🛡️ **Row Level Security** para multi-tenant

```bash
# Configurar banco (primeira vez)
npm run db:setup

# Executar scraper com banco integrado
npm run scrape:full

# Ver estatísticas do banco
npm run db:stats
```

📚 **Documentação completa**: [`/database/`](./database/)

## 🚀 Quick Start

### 1. **Clone e Install**

```bash
git clone https://github.com/leandrofl/aliexpress-scraper-nodejs.git
cd aliexpress-scraper-nodejs
npm install
```

### 2. **Configure Environment**

Create `.env` file:

```env
# Google Translate API
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account.json

# Scraping Configuration
CATEGORIES=wireless headphones,smartphone cases,fitness tracker
MIN_SALES=100
MIN_REVIEWS=20
MAX_PRODUCTS_RAW=50
## 🧪 Testing & Quality

### Run Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:margin
npm run test:filters
npm run test:integration
```

### Test Coverage
- **Unit Tests**: Core functionality validation
- **Integration Tests**: End-to-end workflow testing
- **Exploratory Tests**: Real API and scraping validation

## 📚 Documentation

Comprehensive documentation available in `docs/`:

- **System Architecture**: Component interaction and data flow
- **API Integration**: Google Translate and ML scraping setup
- **Changelog**: Complete history of improvements and fixes
- **Configuration Guide**: Environment setup and optimization

## 🔧 Advanced Configuration

### Google Translate Setup
1. Create Google Cloud Project
2. Enable Translate API
3. Create Service Account
4. Download JSON credentials
5. Set `GOOGLE_APPLICATION_CREDENTIALS` path

### Performance Optimization
- Adjust `MAX_PRODUCTS_RAW` for collection size
- Configure `TARGET_PRODUCTS_FINAL` for filtered results
- Set appropriate `MIN_SALES` and `MIN_REVIEWS` thresholds
- Enable/disable `HEADLESS` mode for debugging

## 🚀 Features Overview

- ✅ **Stealth Scraping**: Advanced bot detection evasion
- ✅ **Visual Matching**: Perceptual hash product comparison
- ✅ **Smart Translation**: Context-aware search term translation
- ✅ **Real-time ML Data**: Live Mercado Livre price validation
- ✅ **Intelligent Filtering**: Multi-layer product qualification
- ✅ **Risk Assessment**: Supplier and product risk analysis
- ✅ **Excel Export**: Professional reporting with ExcelJS
- ✅ **Comprehensive Testing**: Full test suite coverage
- ✅ **Zero Vulnerabilities**: Security-first architecture

## 🛡️ Security & Best Practices

- Usa `exceljs` no lugar de `xlsx` para evitar vulnerabilidades
- Usa `puppeteer-extra-plugin-stealth`
- Pode ser facilmente integrado com proxy premium ou residencial no futuro

---

## 🔄 Futuras melhorias (prontas para expansão)

- ✅ Integração com OpenAI para filtro qualitativo real
- ✅ Suporte a múltiplas abas em paralelo
- ✅ Deploy em nuvem com agendamento
