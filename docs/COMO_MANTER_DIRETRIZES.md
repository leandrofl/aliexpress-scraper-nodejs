# 💡 Como Garantir que o Copilot Lembre das Diretrizes

## 🎯 Estratégias Recomendadas

### 1. **Arquivo de Diretrizes (✅ Criado)**
- Mantenha `docs/DIRETRIZES_DESENVOLVIMENTO.md` sempre atualizado
- Referencie este arquivo quando eu não seguir algo
- Use frases como: "Conforme diretrizes em docs/DIRETRIZES_DESENVOLVIMENTO.md"

### 2. **Comandos Padronizados**
Use sempre os mesmos comandos para ações específicas:

```bash
# Para continuar sem perguntas
"Continue" ou "Continue to iterate"

# Para organizar projeto
"Organizar projeto conforme diretrizes"

# Para limpeza geral
"Fazer limpeza padrão do projeto"
```

### 3. **Lembretes Contextuais**
Quando eu esquecer algo, use frases como:
- "Lembre-se: sempre continuar quando eu disser 'Continue'"
- "Conforme nossa diretriz padrão de organização..."
- "Como estabelecido anteriormente..."

### 4. **Configuração no VS Code**
Considere criar snippets ou comandos personalizados:

```json
// .vscode/settings.json
{
    "copilot.directive": "Sempre seguir docs/DIRETRIZES_DESENVOLVIMENTO.md",
    "copilot.autoComplete": "continue-tasks",
    "copilot.behavior": "proactive"
}
```

### 5. **Arquivo de Contexto Rápido**
Mantenha um arquivo `CONTEXTO_ATUAL.md` sempre atualizado com:
- Estado atual do projeto
- Última tarefa executada
- Próximas ações planejadas
- Diretrizes específicas ativas

## 🔄 Como Usar na Prática

### ✅ **Faça Assim:**
```
"Continue [ação específica] conforme diretrizes"
"Organize conforme padrão estabelecido"
"Execute limpeza padrão"
```

### ❌ **Evite:**
```
"O que você acha que devemos fazer?"
"Pode continuar?"
"Qual seria o próximo passo?"
```

## 🎯 Implementação Imediata

1. **Salve este arquivo** para referência futura
2. **Atualize diretrizes** conforme novas necessidades
3. **Referencie o arquivo** quando eu não seguir algo
4. **Use comandos padronizados** para ações recorrentes

---

**Dica**: Quando eu esquecer algo, simplesmente diga: "Revise docs/DIRETRIZES_DESENVOLVIMENTO.md e continue"
