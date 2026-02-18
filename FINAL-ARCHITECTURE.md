# ✅ ARQUITETURA FINAL - Supabase + LAB 512 Agent

## Problema Resolvido

❌ **Antes**: Sessão em memória (frágil, perde contexto ao reiniciar)
✅ **Agora**: Supabase persistência + Agent stateless (robusto!)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  PWA (iPhone / LAB 256 / LAB 512 / LAB 8GB)             │
│  - Interface de chat                                     │
│  - Lista de conversas na sidebar                         │
│  - Instalável como app nativo                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│  SUPABASE (Persistência Permanente)                      │
│                                                           │
│  📊 conversations                                         │
│     - id, user_id, title, timestamps                     │
│                                                           │
│  💬 messages                                              │
│     - id, conversation_id, role, content                 │
│     - commands_executed, timestamps                      │
│                                                           │
│  🔴 Realtime: Atualiza UI automaticamente                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│  LAB 512 Agent Server (STATELESS)                        │
│  - Porta 3737                                            │
│  - Recebe: message + history + conversationId            │
│  - Processa com Claude                                   │
│  - Executa comandos                                      │
│  - Retorna resposta                                      │
│  - NÃO mantém estado (mais confiável!)                   │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de Uma Mensagem

```
1. Usuário digita "Qual o status do PM2?" no PWA

2. PWA → Supabase:
   INSERT INTO messages (conversa_x, role='user', content='...')

3. PWA → LAB 512 Agent:
   POST /chat {
     message: "Qual o status do PM2?",
     history: [últimas 50 mensagens da conversa],
     conversationId: "conversa_x"
   }

4. Agent:
   - Recebe histórico completo
   - Chama Claude com contexto
   - Claude decide executar: pm2 list
   - Executa comando no terminal
   - Retorna resposta com output

5. Agent → PWA:
   {
     response: "Tenho 3 processos rodando...",
     commandsExecuted: [{command: "pm2 list", output: "..."}]
   }

6. PWA → Supabase:
   INSERT INTO messages (conversa_x, role='assistant', content='...')

7. Supabase Realtime → Todos os dispositivos:
   Nova mensagem aparece automaticamente!
```

---

## Benefícios

### ✅ Persistência Permanente
- Histórico nunca se perde
- Reiniciar agent não afeta nada
- Crash recovery automático

### ✅ Múltiplas Conversas
- Sidebar com lista de chats
- Cada conversa = contexto isolado
- Título auto-gerado da primeira mensagem

### ✅ Multi-Device
- iPhone, LAB 256, LAB 512, LAB 8GB
- Todos veem as mesmas conversas
- Sincronização em tempo real

### ✅ Stateless Agent
- Mais confiável (sem estado em memória)
- Pode rodar múltiplas instâncias
- Escala horizontalmente
- Deploy/restart sem perder contexto

### ✅ Supabase Features
- Row Level Security (RLS)
- Realtime subscriptions
- Backups automáticos
- Auth integrado

---

## Setup

### 1. Supabase Setup

```bash
# 1. Vai em supabase.com
# 2. Cria novo projeto
# 3. SQL Editor → Cola supabase-schema.sql
# 4. Execute!
```

### 2. Variáveis de Ambiente

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_AGENT_URL=https://agent.tdln.logline.world
```

### 3. Agent Server (LAB 512)

```bash
cd ~/remote-agent
export CLAUDE_API_KEY='sua-key'

# Roda agent
node server-persistent.js

# Ou via PM2
pm2 start server-persistent.js --name lab512-agent
pm2 save
```

### 4. Deploy PWA

```bash
# Vercel
cd realtime-messaging-app
vercel deploy

# Ou self-hosted
pnpm build
pm2 start pnpm --name lab512-ui -- start
```

---

## Como Usar

### Criar Conversa
1. Abre PWA
2. "Nova Conversa" na sidebar
3. Digita mensagem
4. Título é gerado automaticamente

### Conversar
- Claude mantém contexto COMPLETO da conversa
- Pode referenciar mensagens antigas
- Executa comandos quando necessário

### Multi-Device
- iPhone: Instala PWA
- LAB 256: Abre no browser
- LAB 512: Localhost ou tunnel
- Todos veem mesmas conversas!

### Buscar Conversas
- Sidebar mostra todas conversas
- Ordenadas por última atividade
- Click para trocar de conversa

---

## Estrutura de Arquivos

```
realtime-messaging-app/
  ├── supabase-schema.sql         # Schema do banco
  ├── lib/chat/
  │   ├── supabase-agent-adapter.ts  # Adapter principal
  │   ├── index.ts                   # Config (usa Supabase)
  │   └── types.ts
  └── .env.local

remote-agent/
  ├── server-persistent.js        # Agent stateless
  ├── ARCHITECTURE.md             # Esta doc
  └── README.md
```

---

## Monitoramento

### Health Check
```bash
curl https://agent.tdln.logline.world/health
```

### Logs Agent
```bash
# Via TeamViewer no LAB 512
pm2 logs lab512-agent
```

### Supabase Dashboard
- Table Editor: Ver mensagens/conversas
- Logs: Ver queries em tempo real
- Performance: Métricas de uso

---

## Troubleshooting

**Agent não responde:**
```bash
# LAB 512
pm2 restart lab512-agent
pm2 logs lab512-agent
```

**Mensagens não aparecem em tempo real:**
- Verifica Realtime no Supabase dashboard
- Verifica RLS policies
- Testa subscription no console

**Contexto não funciona:**
- Agent recebe `history` no request?
- Verifica logs: `console.log` no adapter
- Testa com curl:
```bash
curl -X POST https://agent.tdln.logline.world/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "teste",
    "history": [{"role":"user","content":"oi"}],
    "conversationId": "test"
  }'
```

---

## Segurança (TODO)

- [ ] Cloudflare Access no agent
- [ ] Service tokens no adapter
- [ ] Rate limiting (Supabase Edge Functions)
- [ ] Audit log de comandos executados
- [ ] Whitelist de comandos permitidos

---

## 🎉 Resultado Final

Agora você tem:
1. ✅ Chat app instalável (PWA)
2. ✅ Múltiplas conversas organizadas
3. ✅ Histórico permanente (Supabase)
4. ✅ Agent confiável (stateless)
5. ✅ Sincronização multi-device
6. ✅ Execução de comandos com contexto
7. ✅ Funciona mesmo se agent crashar

**Exatamente como você pediu!** 🚀
