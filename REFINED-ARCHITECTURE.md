# 🎯 Arquitetura Refinada - Multi-Agent System

## Mudanças da Proposta Anterior

### ❌ Proposta Original (Descartada)
- Agent autentica no Supabase
- Agent salva mensagens direto no DB
- Adapter TAMBÉM salva mensagens
- **Problemas**: Duplicação, race conditions, complexidade

### ✅ Arquitetura Refinada (Atual)
- **Agent = HTTP processor puro** (stateless, sem Supabase)
- **Adapter = single source of truth** (controla toda persistência)
- **Mensagens mantêm identidade** (user_id correto sem agent autenticar)

---

## Fluxo Completo Refinado

```
1. 📱 User envia: "pm2 list"
   ↓
2. 🔵 Adapter:
   - Busca conversation → pega agent_user_id e agent_url
   - Salva user message (user_id = seu UUID)
   - Busca histórico (50 mensagens)
   ↓
3. 🌐 HTTP POST → Agent (lab512.agent.com/chat)
   Body: {message, history, conversationId}
   ↓
4. 🤖 Agent (LAB 512):
   - Recebe contexto completo
   - Processa com Claude API
   - Executa comandos se necessário
   - RETORNA resposta (não salva nada)
   ↓
5. 🔵 Adapter:
   - Recebe resposta do agent
   - Salva assistant message (user_id = agent_user_id!)
   ↓
6. ⚡ Supabase Realtime:
   - Notifica PWA de nova mensagem
   ↓
7. 📱 User vê resposta instantaneamente
```

---

## Componentes

### 1. Schema SQL (`supabase-schema.sql`)

```sql
conversations:
  - user_id (UUID) → Dono da conversa (você)
  - agent_user_id (UUID) → Agent que responde
  - agent_url (TEXT) → URL do agent
  - title, metadata, timestamps...

messages:
  - user_id (UUID) → Quem enviou (user OU agent)
  - conversation_id (UUID) → Qual conversa
  - role ('user'|'assistant'|'system')
  - content, commands_executed...

RLS Policies:
  - Users veem suas conversas (user_id = auth.uid())
  - Agents veem conversas onde são agents (agent_user_id = auth.uid())
  - Ambos podem ler/escrever mensagens
```

### 2. Agents no Supabase

**Criação** (`scripts/create-agents.sh`):
```bash
# Cria users no Supabase Auth:
- lab512@agent.local (UUID gerado)
- lab8gb@agent.local (UUID gerado)
- lab256@agent.local (UUID gerado)

# Salva em .env.agents:
LAB512_USER_ID=uuid-xxx
LAB8GB_USER_ID=uuid-yyy
LAB256_USER_ID=uuid-zzz
AGENT_PASSWORD=senha-forte-gerada
```

**IMPORTANTE**: Agents são users no Auth, MAS agents não autenticam!

### 3. Agent Server (`server-refined.js`)

**Responsabilidades:**
- ✅ Recebe POST /chat com {message, history, conversationId}
- ✅ Processa com Claude API
- ✅ Executa comandos EXECUTE_COMMAND: ...
- ✅ Retorna {response, commandsExecuted}
- ❌ NÃO salva no Supabase
- ❌ NÃO autentica

**Configuração:**
```bash
# LAB 512 (Lisboa)
export AGENT_NAME="LAB 512"
export CLAUDE_API_KEY="sk-ant-..."
export PORT=3737
node server-refined.js
```

### 4. Adapter (`supabase-agent-adapter.ts`)

**Responsabilidades:**
- ✅ Busca conversation (pega agent_user_id + agent_url)
- ✅ Salva user message
- ✅ Busca histórico
- ✅ Envia para agent via HTTP
- ✅ Salva agent response COM user_id = agent_user_id
- ✅ Subscribe Realtime

**Código chave:**
```typescript
// Busca conversa
const {agent_user_id, agent_url} = await getConversation(roomId)

// Salva user message
await supabase.from('messages').insert({
  user_id: currentUserId,  // Seu UUID
  role: 'user'
})

// Chama agent
const response = await fetch(`${agent_url}/chat`, {
  body: JSON.stringify({message, history})
})

// Salva agent response
await supabase.from('messages').insert({
  user_id: agent_user_id,  // UUID do agent!
  role: 'assistant'
})
```

### 5. PWA UI

**Create Conversation:**
```typescript
// User escolhe qual agent
const machines = [
  {name: 'LAB 512', userId: 'uuid-lab512', url: 'https://lab512.agent.com'},
  {name: 'LAB 8GB', userId: 'uuid-lab8gb', url: 'https://lab8gb.agent.com'},
  {name: 'LAB 256', userId: 'uuid-lab256', url: 'http://localhost:3737'}
]

// Cria conversa
await adapter.createConversation(
  myUserId,
  machine.userId,      // agent_user_id
  machine.url,         // agent_url
  machine.name         // title
)
```

---

## Vantagens da Arquitetura Refinada

### ✅ Simplicidade
- Agent é HTTP server simples (não precisa SDK do Supabase)
- Sem autenticação complexa no agent
- Adapter é única fonte de verdade

### ✅ Sem Race Conditions
- Apenas adapter escreve no Supabase
- Ordem garantida: user msg → agent call → agent response
- Realtime sempre notifica após persistência

### ✅ Identidade Correta
- Mensagens aparecem com user_id correto
- UI pode mostrar "LAB 512 respondeu" (não "agent genérico")
- Histórico claro de quem falou

### ✅ Escalabilidade
- Agent pode rodar em qualquer lugar (não precisa credentials)
- Pode usar load balancer na frente dos agents
- Pode ter múltiplos agents por máquina (diferentes ports)

### ✅ Segurança
- Agent não precisa service role key
- RLS protege dados no Supabase
- Agent só processa, não acessa DB

---

## Setup Completo

### Passo 1: Supabase

```bash
# 1. Rode schema SQL
# Dashboard → SQL Editor → Cole supabase-schema.sql → Run

# 2. Crie agents
cd realtime-messaging-app/scripts
chmod +x create-agents.sh
./create-agents.sh

# Gera .env.agents com UUIDs:
LAB512_USER_ID=xxx
LAB8GB_USER_ID=yyy
LAB256_USER_ID=zzz
```

### Passo 2: Deploy Agents

```bash
# LAB 512 (Lisboa)
cd ~/remote-agent
export AGENT_NAME="LAB 512"
export CLAUDE_API_KEY="sk-ant-..."
export PORT=3737
node server-refined.js
# Ou: pm2 start server-refined.js --name lab512-agent

# LAB 8GB (Lisboa)
export AGENT_NAME="LAB 8GB"
export PORT=3738
node server-refined.js

# LAB 256 (Paris)
export AGENT_NAME="LAB 256"
export PORT=3737
node server-refined.js
```

### Passo 3: Cloudflare Tunnel

```bash
# LAB 512
cloudflared tunnel run --url http://localhost:3737 lab512

# LAB 8GB
cloudflared tunnel run --url http://localhost:3738 lab8gb
```

### Passo 4: PWA Config

```bash
# .env.local (LAB 256 para dev local)
NEXT_PUBLIC_SUPABASE_URL=https://izwbwcdvdetfhghquqkv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Passo 5: Create Conversations no UI

```typescript
// Hardcode agent UUIDs (ou busca de .env)
const AGENTS = [
  {
    id: 'LAB512_USER_ID_FROM_ENV',
    name: '💻 LAB 512',
    url: 'https://lab512.agent.com'
  },
  {
    id: 'LAB8GB_USER_ID_FROM_ENV',
    name: '🖥️ LAB 8GB',
    url: 'https://lab8gb.agent.com'
  },
  {
    id: 'LAB256_USER_ID_FROM_ENV',
    name: '💼 LAB 256',
    url: 'http://localhost:3737'
  }
]

// UI mostra botão "Nova Conversa" → escolhe agent
```

---

## Testing

```bash
# 1. Health check do agent
curl http://localhost:3737/health | jq

# 2. Test chat direto
curl -X POST http://localhost:3737/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "qual seu hostname?",
    "history": [],
    "conversationId": "test-123"
  }' | jq

# 3. Via PWA
# - Login no PWA
# - Cria conversa com LAB 512
# - Envia: "uptime"
# - Verifica resposta
```

---

## Monitoring

```bash
# Agent logs
pm2 logs lab512-agent

# Agent stats
curl http://localhost:3737/health

# Supabase logs
# Dashboard → Logs → Database → postgres_changes

# Realtime status
# Dashboard → Database → Replication
```

---

## Comparação: Antes vs Depois

| Aspecto | Proposta Original | Arquitetura Refinada |
|---------|------------------|---------------------|
| Agent autentica? | ✅ Sim | ❌ Não |
| Agent salva no DB? | ✅ Sim | ❌ Não |
| Adapter salva? | ✅ Sim | ✅ Sim |
| Writes no DB | 2x (duplo) | 1x (único) |
| Race conditions | ⚠️ Possível | ✅ Impossível |
| Complexidade agent | 🔴 Alta | 🟢 Baixa |
| Dependencies agent | Supabase SDK + Auth | ❌ Nenhuma |
| Single source of truth | ❌ Não | ✅ Adapter |
| user_id correto | ✅ Sim | ✅ Sim |

---

## Próximos Passos

1. ✅ Schema SQL atualizado
2. ✅ Adapter refinado
3. ✅ Agent server simplificado
4. ⏳ Criar UI para nova conversa (escolher agent)
5. ⏳ Rodar create-agents.sh
6. ⏳ Deploy agents nos LABs
7. ⏳ Testar end-to-end

**Status**: Arquitetura completa e refinada! Pronta para implementação.
