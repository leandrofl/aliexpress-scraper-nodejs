# 🎯 Diretrizes de Desenvolvimento - AliExpress Scraper

## 📋 Instruções Gerais para o Copilot

### ⚡ Comandos e Comportamentos Esperados

#### 1. **Quando o usuário disser "Continue" ou "Continue: Continue to iterate?"**
- **SEMPRE** continuar a tarefa em andamento
- **NÃO** perguntar se deve continuar
- **NÃO** parar para confirmação
- **AGIR IMEDIATAMENTE** na sequência lógica da tarefa

#### 2. **Organização de Arquivos**
- Documentação: arquivos `.md` devem ficar SEMPRE em `docs/`. Se surgir algo fora, mover para `docs/` ou apagar se não fizer sentido.
- Testes: arquivos de teste devem ficar SEMPRE em `unitTests/` (por categoria). Não criar `tests/`. Testes temporários devem ser apagados após uso ou movidos para `unitTests/` (geralmente `unitTests/exploratory/`).
- Banco de dados: arquivos SQL/MD de banco devem ficar em `database/`.
- Consolidar duplicatas sem perguntar.
- Remover automaticamente arquivos v2/backup/old/bak após validação.
- Manter estrutura modular limpa.

#### 3. **Documentação**
- Sempre criar/atualizar README.md após mudanças estruturais
- Documentar todas as modificações em changelog
- Usar emojis para melhor visualização
- Manter documentação em português quando solicitado

#### 4. **Testes**
- Sempre executar testes básicos após modificações
- Verificar integridade do projeto
- Remover duplicatas automaticamente
- Organizar por categoria (core, exploratory, filters, validation)

#### 5. **Comunicação**
- Ser direto e objetivo
- Não repetir explicações desnecessárias
- Focar na ação solicitada
- Reportar apenas o essencial

### 🔄 Fluxo de Trabalho Padrão

1. **Ler a solicitação completa**
2. **Verificar diretrizes existentes**
3. **Executar sem confirmar tarefas óbvias**
4. **Remover arquivos duplicados** (v2, backup, old, bak)
5. **Mover arquivos de teste temporários** para unitTests/exploratory/
6. **Documentar mudanças importantes**
7. **Testar funcionalidade básica**
8. **Reportar resultado conciso**

### ⚠️ Pontos de Atenção

- **NÃO** interromper fluxo com perguntas desnecessárias
- **NÃO** explicar o que é óbvio
- **NÃO** deixar arquivos de teste temporários na raiz (nem recriar pasta `tests/`)
- **NÃO** criar `.env.example` (o projeto já possui `.env`)
- **SIM** manter arquivos de banco somente em `database/`
- **SIM** ser proativo em organizações
- **SIM** manter padrões estabelecidos
- **SIM** documentar decisões importantes
- **SIM** mover testes para unitTests/exploratory/

### 🎨 Preferências de Estilo

- **Usar emojis** para melhor organização visual
- **Títulos descritivos** em arquivos markdown
- **Estrutura hierárquica** clara em documentação
- **Logs informativos** durante execução
- **Português brasileiro** como padrão

---

**Criado em**: 07/08/2025  
**Objetivo**: Manter consistência e eficiência no desenvolvimento  
**Status**: 🔄 Diretrizes ativas

## 🧭 Diretrizes adicionais: MVP Shopify agora, SaaS depois

### 1) Objetivos de produto
- MVP: alimentar catálogo Shopify (dropship AliExpress → ML verificação de preço/margem).
- Futuro: oferecer o scraper como SaaS multi-tenant (licenças para terceiros).

### 2) Políticas de “revisão crítica” (não concordar automaticamente)
- Sempre avaliar sugestões sob 2 perspectivas:
	- Especialista em dropshipping (demanda, margem, lead time, devoluções, restrições de categoria).
	- Especialista em scraping Node.js (robustez, anti-bot, performance, manutenção, custo).
- Em cada mudança, responder com:
	- Riscos e trade-offs.
	- Alternativas de menor risco e experimento rápido recomendado.

### 3) Requisitos de SaaS-readiness (desde já)
- Configurações 100% via variáveis de ambiente; nada hardcoded.
- Isolar integrações (Shopify, Supabase, etc.) atrás de interfaces; permitir “stubs” para SaaS.
- Rate limiting, backoff e quotas por “tenantId”.
- Logs estruturados (JSON) com correlationId/tenantId (sem PII).
- Feature flags: ML_DEBUG_ARTIFACTS, HEADLESS, MAX_CONCURRENCY, TIMEOUTS_MS.
- Observabilidade mínima: métricas de sucesso/falha por etapa (navegar, extrair, comparar, enriquecer, PDP).

### 4) Scraping resiliente no ML
- Ordem visual: DOM-first. Complemento: ld+json. Fallback: __PRELOADED_STATE__. Último recurso: HTTP (axios+cheerio).
- IDs MLB por regex /MLB-?(\d+)/; normalizar URLs (remover queries longas).
- Ad type: enriquecer via printed_result quando disponível.
- Não travar em preço ausente (price_brl: null); PDP é a fonte canônica de preço/imagens.

### 5) Artefatos e debug
- Por padrão: não salvar HTML/JSON/screenshot. Habilitar só com ML_DEBUG_ARTIFACTS=true.
- Quando ativo: salvar em output/ com timestamp; nunca em produção multi-tenant.

### 6) Pipeline de qualificação (resumo)
- Buscar top-N; abrir PDP do top-N para imagens grandes; comparar imagem+título (score final ≥ 0.65).
- Estatísticas de preço e margem com base no top 3; ML preço é referência para margem.

### 7) Performance e limites
- Paralelizar até MAX_CONCURRENCY seguro; respeitar rate-limit e randomizar headers.
- Retries com jitter; tempos configuráveis.

---
Atualizado: 11/08/2025 — inclusão de diretrizes MVP→SaaS e revisão crítica.
