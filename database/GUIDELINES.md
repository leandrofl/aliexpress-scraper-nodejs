# 📂 Diretrizes de Organização - Database

## 🎯 **Objetivo**
Manter todos os arquivos relacionados ao banco de dados organizados na pasta `/database/` para facilitar manutenção e desenvolvimento.

## 📁 **Estrutura Atual**

```
/database/
├── 🔧 Core Files
│   ├── supabase-client.js      # Cliente de conexão
│   ├── database-integration.js # CRUD operations
│   └── setup-database.js       # Setup e testes
├── 🗃️ Schema Files  
│   ├── schema.sql              # Schema completo
│   ├── schema-minimo.sql       # Schema simplificado
│   └── opcional-views-rls.sql  # Configurações extras
└── 📚 Documentation
    ├── INDEX.md                # Índice da pasta
    ├── README.md               # Guia técnico
    └── SETUP-SUPABASE.md       # Setup rápido
```

## ✅ **O que DEVE ficar em `/database/`**

### Arquivos de Schema
- ✅ `*.sql` - Todos os arquivos SQL
- ✅ Migrations e scripts de banco
- ✅ Backups de esquema

### Arquivos de Integração
- ✅ Clientes de conexão (`*-client.js`)
- ✅ Camadas de integração (`*-integration.js`)
- ✅ Scripts de setup (`setup-*.js`)
- ✅ Utilitários de banco (`*-utils.js`)

### Documentação Específica
- ✅ READMEs específicos do banco
- ✅ Guias de configuração
- ✅ Documentação de APIs do banco

## ❌ **O que NÃO deve ir para `/database/`**

### Configurações do Projeto
- ❌ `.env` (fica na raiz)
- ❌ `config.js` (configurações gerais)
- ❌ `package.json`

### Scripts Principais
- ❌ `main.js` (execução principal)
- ❌ Scripts de deploy ou CI/CD

### Documentação Geral
- ❌ `README.md` principal
- ❌ Documentação de funcionalidades não-DB

## 🔄 **Processo de Movimentação**

### Ao adicionar novo arquivo relacionado ao BD:

1. **Criar na pasta** `/database/`
2. **Atualizar imports** nos arquivos que usam
3. **Documentar** no `INDEX.md` da pasta
4. **Testar** se ainda funciona

### Exemplo de import correto:
```javascript
// ✅ Correto - referência relativa da raiz
import { funcao } from './database/arquivo.js';

// ❌ Evitar - referência absoluta  
import { funcao } from '/absolute/path/arquivo.js';
```

## 🧪 **Teste de Verificação**

Após qualquer mudança, execute:

```bash
# Teste de setup
npm run db:setup

# Teste de integração
npm run db:stats

# Teste completo
npm run scrape:full
```

## 📋 **Checklist de Organização**

- [x] Arquivos SQL movidos para `/database/`
- [x] Documentação específica organizada
- [x] Scripts de banco na pasta correta
- [x] Imports atualizados e funcionando
- [x] Tests executando corretamente
- [x] Documentação atualizada

## 🎯 **Benefícios desta Organização**

1. **📂 Facilita manutenção** - Tudo relacionado ao BD em um lugar
2. **🔍 Melhora busca** - Desenvolvedores sabem onde procurar
3. **⚡ Acelera desenvolvimento** - Estrutura clara e previsível
4. **🛡️ Reduz erros** - Menos chances de modificar arquivos errados
5. **📚 Documenta melhor** - Cada pasta tem propósito específico

---

**📍 Lembre-se**: Esta organização facilita tanto o desenvolvimento quanto a manutenção futura do projeto!
