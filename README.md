
# 📦 LoopStore Scraper – Node.js + Puppeteer Extra

Este projeto realiza a mineração de produtos no AliExpress com:

- Navegador automatizado (Puppeteer Extra + Stealth + Proxy)
- Scroll dinâmico + evasão de fingerprint
- Filtros quantitativos, qualitativos (placeholder) e risco
- Exportação automática para Excel (`.xlsx`) via `exceljs`
- Modularização e logs visuais profissionais

---

## 🚀 Como executar

### 1. **Clone o projeto**

```bash
git clone https://github.com/seu-usuario/loopstore-scraper.git
cd loopstore-scraper
```

### 2. **Instale as dependências**

```bash
npm install
```

> 🔐 Este projeto já usa bibliotecas seguras (`exceljs` no lugar de `xlsx`) e `puppeteer-extra` com stealth.

### 3. **Configure o ambiente**

Edite o arquivo `.env` com seus parâmetros (já incluído):

```env
CATEGORIES=Casa & Cozinha,Tecnologia,Beleza
MIN_SALES=500
MIN_REVIEWS=50
...

CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
HEADLESS=true
ENABLE_SCREENSHOTS=false
```

### 4. **Execute o scraper**

```bash
npm run scrape
```

> Ou diretamente:

```bash
node main.js
```

---

## 📁 Estrutura de diretórios

```
├── main.js                  # Entrada principal
├── config.js                # Configurações centralizadas
│
├── scraper/
│   ├── aliexpressScraper.js
│   ├── utils.js
│
├── filters/
│   ├── quantitative.js
│   ├── qualitative.js
│   ├── riskAssessment.js
│
├── export/
│   ├── excelExporter.js
│
├── output/                  # Arquivos Excel gerados
├── scraper/debug_files/     # Screenshots, HTMLs, JSONs (opcional)
├── .env
├── package.json
```

---

## ✨ Recursos implementados

- ✅ Scraping real com evasão de bot detection
- ✅ Filtros quantitativos com base em `.env`
- ✅ Qualitativos deixados como `null` para futura IA
- ✅ Avaliação de risco do fornecedor
- ✅ Exportação dinâmica para `.xlsx` (todos os campos)

---

## 🛡️ Segurança e boas práticas

- Usa `exceljs` no lugar de `xlsx` para evitar vulnerabilidades
- Usa `puppeteer-extra-plugin-stealth`
- Pode ser facilmente integrado com proxy premium ou residencial no futuro

---

## 🔄 Futuras melhorias (prontas para expansão)

- ✅ Integração com OpenAI para filtro qualitativo real
- ✅ Suporte a múltiplas abas em paralelo
- ✅ Deploy em nuvem com agendamento
