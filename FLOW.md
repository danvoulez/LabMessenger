# 🔄 Fluxo Completo - LAB 512 Remote Control

## Visão Geral

```
iPhone (Paris) → PWA → Supabase → Agent (LAB 512 Lisboa) → Terminal → Resposta
```

## Passo a Passo Detalhado

### 1️⃣ **Usuário Envia Mensagem**
- **Onde**: iPhone em Paris acessando PWA
- **Página**: `/app/agent/page.tsx`
- **Ação**: Usuário digita "ls -la" e aperta enviar

```typescript
// app/agent/page.tsx - linha ~100
await chatProvider.sendMessage({
  content: "ls -la",
  userId: currentUserId,
  username: currentUsername,
  roomId: 'lab512-remote'
})
```

---

### 2️⃣ **Adapter Salva no Supabase**
- **Arquivo**: `/lib/chat/supabase-agent-adapter.ts`
- **Ação**: Salva mensagem do usuário na tabela `messages`

```typescript
// supabase-agent-adapter.ts - linha ~65
const { data: userMessage } = await this.supabase
  .from('messages')
  .insert({
    conversation_id: 'lab512-remote',
    user_id: currentUserId,
    role: 'user',
    content: 'ls -la',
    status: 'sent'
  })
```

**✅ Checkpoint**: Mensagem já está salva! Se algo der errado, não se perde.

---

### 3️⃣ **Adapter Busca Histórico**
- **Arquivo**: `/lib/chat/supabase-agent-adapter.ts`
- **Ação**: Busca últimas 50 mensagens da conversa

```typescript
// supabase-agent-adapter.ts - linha ~77
const { data: history } = await this.supabase
  .from('messages')
  .select('role, content, created_at')
  .eq('conversation_id', 'lab512-remote')
  .order('created_at', { ascending: true })
  .limit(50)

// history = [
//   { role: 'user', content: 'qual seu hostname?' },
//   { role: 'assistant', content: 'LAB-512.local' },
//   { role: 'user', content: 'ls -la' }  ← mensagem atual
// ]
```

**🔑 Chave da Arquitetura**: Agent recebe contexto completo!

---

### 4️⃣ **Adapter Envia para Agent**
- **Arquivo**: `/lib/chat/supabase-agent-adapter.ts`
- **Ação**: POST para `http://agent.tdln.logline.world/chat` (ou localhost:3737)

```typescript
// supabase-agent-adapter.ts - linha ~91
const agentResponse = await fetch(`${this.agentUrl}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'ls -la',
    conversationId: 'lab512-remote',
    history: history  // ← CONTEXTO COMPLETO!
  }),
  signal: AbortSignal.timeout(60000) // 60s
})
```

**🌐 Rede**: Cloudflare Tunnel conecta Paris → Lisboa

---

### 5️⃣ **Agent Recebe Request**
- **Arquivo**: `/remote-agent/server-persistent.js`
- **Onde**: LAB 512 em Lisboa
- **Ação**: Servidor Node.js recebe POST

```javascript
// server-persistent.js - linha ~175
if (req.method === 'POST' && req.url === '/chat') {
  const { message, history, conversationId } = JSON.parse(body)
  
  console.log(`📨 Request #${totalRequests}`)
  console.log(`   Histórico: ${history.length} mensagens`)
  console.log(`   Mensagem: ${message}`)
  
  // ...processa
}
```

---

### 6️⃣ **Agent Chama Claude API**
- **Arquivo**: `/remote-agent/server-persistent.js`
- **Ação**: Monta contexto e envia para Claude

```javascript
// server-persistent.js - linha ~35
async function callClaude(message, conversationHistory) {
  const messages = []
  
  // Adiciona histórico anterior
  conversationHistory.forEach(msg => {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })
  })
  
  // Adiciona mensagem atual
  messages.push({ role: 'user', content: message })
  
  // Chama API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      messages: messages,
      system: `Você é agente remoto no LAB 512...
      
      Para executar comandos, retorne:
      EXECUTE_COMMAND: ls -la
      `
    })
  })
}
```

---

### 7️⃣ **Claude Processa e Responde**
- **Onde**: API da Anthropic
- **Resposta**: Claude analisa histórico e decide executar comando

```
EXECUTE_COMMAND: ls -la
```

---

### 8️⃣ **Agent Executa Comando**
- **Arquivo**: `/remote-agent/server-persistent.js`
- **Ação**: Detecta `EXECUTE_COMMAND:` e executa via `child_process`

```javascript
// server-persistent.js - linha ~96
async function executeCommand(command) {
  const { stdout, stderr } = await execAsync(command, {
    cwd: process.env.HOME,
    timeout: 30000
  })
  
  return {
    success: true,
    output: stdout,
    command
  }
}

// server-persistent.js - linha ~115
async function processClaudeResponse(response) {
  const commands = extractCommands(response) // ['ls -la']
  
  const executions = []
  for (const cmd of commands) {
    const result = await executeCommand(cmd)
    executions.push(result)
  }
  
  // Envia resultados de volta para Claude
  const followUp = await callClaude(
    `Resultados:\n${executions.map(e => e.output).join('\n')}`
  )
  
  return { text: followUp, executions }
}
```

**⚙️ Execução Real**: Comando roda no terminal do LAB 512!

---

### 9️⃣ **Agent Retorna Resposta**
- **Arquivo**: `/remote-agent/server-persistent.js`
- **Ação**: Envia JSON de volta para PWA

```javascript
// server-persistent.js - linha ~195
res.writeHead(200, { 'Content-Type': 'application/json' })
res.end(JSON.stringify({
  response: "Aqui está o resultado do ls -la:\ndrwxr-xr-x  10 user  staff   320 Feb 18 10:30 .\n...",
  commandsExecuted: [
    {
      command: 'ls -la',
      success: true,
      output: 'drwxr-xr-x...'
    }
  ],
  requestId: 42
}))
```

---

### 🔟 **Adapter Salva Resposta**
- **Arquivo**: `/lib/chat/supabase-agent-adapter.ts`
- **Ação**: Salva resposta do agent no Supabase

```typescript
// supabase-agent-adapter.ts - linha ~107
const { data: assistantMessage } = await this.supabase
  .from('messages')
  .insert({
    conversation_id: 'lab512-remote',
    user_id: 'agent',
    role: 'assistant',
    content: agentData.response,
    commands_executed: agentData.commandsExecuted,
    status: 'delivered'
  })
```

**💾 Persistência**: Tudo salvo! Pode fechar o app e voltar depois.

---

### 1️⃣1️⃣ **Realtime Atualiza UI**
- **Arquivo**: `/lib/chat/supabase-agent-adapter.ts`
- **Ação**: Subscription detecta nova mensagem

```typescript
// supabase-agent-adapter.ts - linha ~165
subscribe(roomId: string, callback: MessageCallback): Unsubscribe {
  this.realtimeChannel = this.supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', 
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${roomId}`
      },
      (payload) => {
        const newMessage = transformToMessage(payload.new)
        callback(newMessage)  // ← UI atualiza automaticamente!
      }
    )
    .subscribe()
}
```

**⚡ Tempo Real**: Resposta aparece no iPhone sem reload!

---

### 1️⃣2️⃣ **Usuário Vê Resultado**
- **Onde**: iPhone em Paris
- **Página**: `/app/agent/page.tsx`
- **UI**: Nova mensagem aparece automaticamente

```typescript
// app/agent/page.tsx - linha ~62
chatProvider.subscribe(
  'lab512-remote',
  (newMessage) => {
    setMessages(prev => [...prev, newMessage])  // ← UI atualiza!
  }
)
```

**📱 Resultado Final**: Usuário vê output do `ls -la` do LAB 512!

---

## 🎯 Resumo do Fluxo

| Etapa | Arquivo | Ação | Latência |
|-------|---------|------|----------|
| 1 | `app/agent/page.tsx` | Usuário envia | 0ms |
| 2 | `supabase-agent-adapter.ts` | Salva no Supabase | ~50ms |
| 3 | `supabase-agent-adapter.ts` | Busca histórico | ~30ms |
| 4 | `supabase-agent-adapter.ts` | POST para agent | ~100ms |
| 5 | `server-persistent.js` | Agent recebe | ~5ms |
| 6 | `server-persistent.js` | Chama Claude | ~2000ms |
| 7 | Claude API | Processa | ~1500ms |
| 8 | `server-persistent.js` | Executa comando | ~100ms |
| 9 | `server-persistent.js` | Responde | ~10ms |
| 10 | `supabase-agent-adapter.ts` | Salva resposta | ~50ms |
| 11 | Supabase Realtime | Notifica | ~100ms |
| 12 | `app/agent/page.tsx` | UI atualiza | ~10ms |

**⏱️ Total**: ~4 segundos do envio à resposta

---

## 🚀 Testando o Fluxo

### 1. Inicia Agent (LAB 512)
```bash
cd ~/remote-agent
export CLAUDE_API_KEY='sk-ant-...'
node server-persistent.js
# Servidor rodando em http://localhost:3737
```

### 2. Inicia PWA (LAB 256 ou deploy)
```bash
cd ~/realtime-messaging-app
pnpm dev
# Abre http://localhost:3000
```

### 3. Testa Localmente
- Acesse: http://localhost:3000/agent
- Login com Supabase
- Envia: "qual seu hostname?"
- Resposta: "LAB-512.local"

### 4. Deploy e Testa Remoto
- PWA: Deploy no Vercel (https://lab512.vercel.app)
- Agent: Cloudflare Tunnel (https://agent.tdln.logline.world)
- iPhone: Abre PWA, instala Home Screen

---

## 🔒 Segurança

✅ **Auth**: Supabase Auth (RLS garante isolamento)  
✅ **Agent**: Exposto via Cloudflare Tunnel (HTTPS)  
✅ **API Key**: Claude API Key apenas no agent (não no frontend)  
✅ **Dados**: Criptografados em trânsito e repouso

---

## 🐛 Troubleshooting

### Mensagem não chega
```bash
# Verifica Supabase Realtime
# Dashboard → Database → Replication → Habilita 'messages'
```

### Agent não responde
```bash
# LAB 512
curl http://localhost:3737/health
# Deve retornar: {"status":"ok", ...}
```

### Comando não executa
```bash
# Verifica logs do agent
# LAB 512
tail -f ~/.pm2/logs/lab512-agent-out.log
```

---

## 📊 Monitoramento

```bash
# LAB 512 - Stats do agent
curl http://localhost:3737/health | jq

{
  "status": "ok",
  "totalRequests": 156,
  "totalCommands": 89,
  "uptime": 86400,
  "hostname": "LAB-512.local"
}
```

---

## ✨ Próximos Passos

1. ✅ Schema SQL rodando no Supabase
2. ✅ PWA rodando localmente
3. ⏳ Agent rodando no LAB 512
4. ⏳ Cloudflare Tunnel configurado
5. ⏳ Deploy PWA (Vercel)
6. ⏳ Instalar no iPhone

**Pronto para testar!** 🎉
