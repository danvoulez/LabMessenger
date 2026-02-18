# 🎭 Agent Conversational - Exemplos de Uso

## ✅ Já Funciona: Histórico Completo

O agent **JÁ É conversational** porque recebe todo o histórico:

```javascript
// Adapter envia histórico automático:
fetch(`${agentUrl}/chat`, {
  body: JSON.stringify({
    message: "e quantos cores tem?",
    history: [
      {role: 'user', content: 'qual seu hostname?'},
      {role: 'assistant', content: 'Meu hostname é LAB-512.local'},
      {role: 'user', content: 'e quantos cores tem?'}  // ← Claude vê tudo!
    ]
  })
})
```

---

## 🚀 Novos Recursos

### 1. Conversação Natural

```
User: "oi!"
Agent: "Olá! Tudo ótimo por aqui no LAB 512. Como posso ajudar?"

User: "qual seu nome?"
Agent: "Sou o LAB 512, um Mac rodando macOS em Lisboa."

User: "pode me ajudar com uns comandos?"
Agent: "Claro! Posso executar bash, Python ou Node.js. O que você precisa?"
```

### 2. Bash (como antes)

```
User: "lista os processos pm2"
Agent: "Vou listar os processos PM2 para você.
       EXECUTE_COMMAND: pm2 list"

→ Executa pm2 list
→ Agent: "Aqui estão os processos: [output do comando]"
```

### 3. Python Inline

```
User: "roda um python pra ver uso de cpu"
Agent: "Vou verificar o uso de CPU!
       EXECUTE_PYTHON: import psutil; print(f'CPU: {psutil.cpu_percent()}%')"

→ Executa: python3 -c "import psutil; print(f'CPU: {psutil.cpu_percent()}%')"
→ Agent: "O uso de CPU atual é: 15.3%"
```

### 4. Node.js Inline

```
User: "mostra o hostname com node"
Agent: "Usando Node.js para pegar o hostname!
       EXECUTE_NODE: console.log(require('os').hostname())"

→ Executa: node -e "console.log(require('os').hostname())"
→ Agent: "O hostname é: LAB-512.local"
```

### 5. Scripts Multi-linha

```
User: "cria um script python pra analise de disco"
Agent: "Vou criar um script Python completo!
       EXECUTE_SCRIPT_PYTHON:
       import shutil
       import os
       
       def analyze_disk():
           total, used, free = shutil.disk_usage("/")
           print(f"Total: {total // (2**30)} GB")
           print(f"Used: {used // (2**30)} GB")
           print(f"Free: {free // (2**30)} GB")
           print(f"Usage: {(used/total)*100:.1f}%")
       
       analyze_disk()
       END_SCRIPT"

→ Cria /tmp/agent-script-xxx.py
→ Executa: python3 /tmp/agent-script-xxx.py
→ Deleta arquivo temporário
→ Agent: "Análise completa: [resultados]"
```

---

## 💬 Exemplos Conversacionais Reais

### Exemplo 1: Diagnóstico com Contexto

```
User: "ta lento aqui"
Agent: "Vou verificar o que pode estar causando lentidão."
      EXECUTE_COMMAND: top -l 1 | head -20

[Agent recebe output]

Agent: "Pelo top, vejo que a CPU está em 85%. Vou verificar os processos:
       EXECUTE_COMMAND: ps aux | sort -nrk 3,3 | head -5"

[Agent recebe output]

Agent: "Encontrei! O processo 'node' está usando 60% da CPU. 
       É um processo esperado ou quer que eu investigue mais?"

User: "investiga"
Agent: "Vou ver detalhes desse processo Node:
       EXECUTE_COMMAND: ps aux | grep node | grep -v grep"

[continua conversação...]
```

### Exemplo 2: Deploy com Feedback

```
User: "faz deploy da app"
Agent: "Entendido! Vou fazer o deploy. Primeiro, verifico o git:
       EXECUTE_COMMAND: cd ~/app && git status"

[Agent vê que tem mudanças não commitadas]

Agent: "Opa, tem mudanças não commitadas. Quer que eu:
       1. Faça stash e puxe
       2. Commite as mudanças primeiro
       Qual prefere?"

User: "stash"
Agent: "Beleza! Fazendo stash:
       EXECUTE_COMMAND: cd ~/app && git stash && git pull"

[Vê que pull deu certo]

Agent: "Pull feito! Agora vou instalar dependências:
       EXECUTE_COMMAND: cd ~/app && npm install"

[continua até deploy completo]
```

### Exemplo 3: Análise de Logs com Python

```
User: "analisa os logs de erro da app"
Agent: "Vou criar um script Python para analisar os logs!
       EXECUTE_SCRIPT_PYTHON:
       import re
       from collections import Counter
       
       with open('/var/log/app.log', 'r') as f:
           errors = [line for line in f if 'ERROR' in line]
       
       # Conta tipos de erro
       error_types = Counter()
       for error in errors:
           match = re.search(r'ERROR: (\w+)', error)
           if match:
               error_types[match.group(1)] += 1
       
       print(f"Total de erros: {len(errors)}")
       print("\nTop 5 tipos:")
       for error_type, count in error_types.most_common(5):
           print(f"  {error_type}: {count}")
       END_SCRIPT"

[Script roda]

Agent: "Análise completa! Encontrei 47 erros no total.
       Os principais são:
       - ConnectionError: 23 ocorrências
       - TimeoutError: 15 ocorrências
       - ValidationError: 9 ocorrências
       
       Quer que eu investigue algum tipo específico?"
```

---

## 🎯 Características

### ✅ Totalmente Conversational
- Claude mantém contexto completo
- Respostas naturais e amigáveis
- Lembra de interações anteriores

### ✅ Multi-linguagem
- **Bash**: Comandos shell tradicionais
- **Python**: Scripts e análises
- **Node.js**: JavaScript server-side

### ✅ Scripts Complexos
- Suporte a multi-linha (heredoc style)
- Arquivos temporários gerenciados automaticamente
- Output limpo e organizado

### ✅ Feedback Inteligente
- Claude analisa outputs
- Sugere próximos passos
- Explica erros de forma clara

---

## 🔧 Como Usar

### No iPhone (PWA)

```
💻 LAB 512

Você: "oi, tudo bem?"
LAB 512: "Olá! Tudo ótimo por aqui..."

Você: "lista os processos pm2"
LAB 512: "Claro! Vou listar...
[executa comando]
[mostra output]"

Você: "o que tá usando mais memoria?"
LAB 512: "Vou verificar...
[analisa output anterior]
[executa novo comando]
O processo X está usando 2GB..."
```

### Comandos Especiais

```bash
# Bash
"lista arquivos grandes"
→ EXECUTE_COMMAND: find . -type f -size +100M

# Python
"mostra uso de CPU com python"
→ EXECUTE_PYTHON: import psutil; print(psutil.cpu_percent())

# Node
"hostname com node"
→ EXECUTE_NODE: console.log(require('os').hostname())

# Script Python complexo
"analisa logs de erro"
→ EXECUTE_SCRIPT_PYTHON:
  [script multi-linha]
  END_SCRIPT
```

---

## 🎨 Personalização

Cada agent pode ter personalidade própria:

```bash
# LAB 512 (Lisboa)
export AGENT_NAME="LAB 512 - O Servidor"
# Pode ter system prompt customizado

# LAB 8GB (Lisboa) 
export AGENT_NAME="LAB 8GB - O Trabalhador"
# Mais focado em tarefas pesadas

# LAB 256 (Paris)
export AGENT_NAME="LAB 256 - O Portátil"
# Mais casual e mobile
```

---

## 🚀 Pronto!

Agora cada agent é:
- ✅ **Conversational**: Mantém contexto, conversa naturalmente
- ✅ **Multi-linguagem**: Bash, Python, Node.js
- ✅ **Inteligente**: Analisa outputs, sugere próximos passos
- ✅ **Flexível**: Scripts simples ou complexos

**Teste:**
```bash
cd remote-agent
node server-refined.js
# Envia mensagem via PWA: "oi, tudo bem?"
```
