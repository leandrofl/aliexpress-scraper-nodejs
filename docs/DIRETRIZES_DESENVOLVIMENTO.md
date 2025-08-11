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
