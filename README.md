# 🤖 LAB 512 Remote Control - README

Sistema completo para controlar o LAB 512 em Lisboa remotamente de qualquer lugar (Paris, iPhone, etc).

## ✅ Stack Completa

- **Frontend**: Next.js PWA (instalável no iPhone)
- **Auth**: Supabase Auth (login/signup/session)
- **Database**: Supabase Postgres (conversas + mensagens)
- **Realtime**: Supabase Realtime (sync instantâneo)
- **Backend**: LAB 512 Agent (Node.js + Claude API)
- **Execution**: Comandos shell no LAB 512

---

## 🚀 Quick Start

### 1. Setup Supabase (2 min)

1. [supabase.com](https://supabase.com) → New Project
2. SQL Editor → Cola `supabase-schema.sql` → Run
3. Settings → API → Copia URL + Key

### 2. Config Local

```bash
# Cria .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_AGENT_URL=http://localhost:3737
EOF

# Instala e roda
pnpm install
pnpm dev
```

### 3. Setup Agent no LAB 512

Via TeamViewer:
```bash
cd ~/remote-agent
export CLAUDE_API_KEY='sk-ant-xxx'
node server-persistent.js
```

### 4. Testa!

- http://localhost:3000
- Signup → Login
- Nova Conversa
- "Olá! Qual o hostname?"
- Agent responde! ✅

---

## 📁 Estrutura

```
realtime-messaging-app/
├── README.md                      # Este arquivo
├── FINAL-ARCHITECTURE.md          # Arquitetura detalhada
├── DEPLOY.md                      # Como fazer deploy
├── supabase-schema.sql            # Schema do database
├── lib/chat/
│   └── supabase-agent-adapter.ts  # Adapter principal
└── ...

remote-agent/
├── server-persistent.js           # Agent stateless
└── ARCHITECTURE.md                # Doc do agent
```

---

## 🎯 Features

✅ **Múltiplas conversas** - Sidebar organizada
✅ **Histórico permanente** - Supabase database
✅ **Multi-device** - Sincroniza iPhone/256/512/8GB
✅ **Realtime** - Mensagens instantâneas
✅ **Auth seguro** - Supabase RLS
✅ **PWA** - Instalável como app nativo
✅ **Agent executa** - Comandos shell no LAB 512
✅ **Contexto completo** - Claude lembra de tudo
✅ **Stateless** - Reinicia sem perder contexto

---

## 📱 Deploy & PWA

### Vercel (Recomendado)
```bash
git init && git add . && git commit -m "init"
vercel deploy
# Adiciona env vars no dashboard
```

### iPhone PWA
1. Safari → Abre app
2. Share → Add to Home Screen
3. Pronto! Ícone na home

---

## 🔐 Como Funciona

```
iPhone/Browser
    ↓ (HTTPS)
Supabase
    ├── Auth (login)
    ├── Database (conversas/mensagens)
    └── Realtime (sync)
    ↓
LAB 512 Agent
    ├── Recebe mensagem + histórico
    ├── Claude processa com contexto
    ├── Executa comandos
    └── Retorna resposta
    ↓
Supabase (salva resposta)
    ↓
Realtime atualiza todos devices ✅
```

---

## 📚 Documentação

- **[FINAL-ARCHITECTURE.md](FINAL-ARCHITECTURE.md)** - Arquitetura completa
- **[DEPLOY.md](DEPLOY.md)** - Opções de deploy  
- **[supabase-schema.sql](supabase-schema.sql)** - Schema database
- **[../remote-agent/](../remote-agent/)** - Docs do agent

---

## 🐛 Troubleshooting

### Agent não responde
```bash
# LAB 512 via TeamViewer
pm2 logs lab512-agent
curl http://localhost:3737/health
```

### Realtime não funciona
1. Supabase → Database → Replication
2. Verifica `messages` na lista
3. SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`

### Auth error
- Verifica .env.local
- SUPABASE_URL deve ter https://
- ANON_KEY completo (grande)

---

## 🎉 Pronto!

Agora você tem um **sistema completo** para controlar o LAB 512 de qualquer lugar!

**De Paris você manda comandos em Lisboa pelo iPhone!** 🗼📱🚀
