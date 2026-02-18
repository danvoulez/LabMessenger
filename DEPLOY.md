# 🚀 Deploy LAB 512 Remote Control

## Arquitetura

```
iPhone (PWA)          LAB 512 (Lisboa)
============          ================

Next.js App    --->   remote-agent/server.js (porta 3737)
(Vercel ou              |
 LAB 256)               v
                   Claude API
                       |
                       v
                   exec(comandos)
```

---

## Pré-requisitos

### No LAB 512 (via TeamViewer agora):

1. **Instala Node.js** (se ainda não tem):
```bash
brew install node
```

2. **Copia pasta `remote-agent`** do LAB 256:
```bash
# Via TeamViewer file transfer:
# LAB 256: ~/setup256/remote-agent/
# → LAB 512: ~/remote-agent/
```

3. **Configura Claude API Key**:
```bash
export CLAUDE_API_KEY='sua-api-key-aqui'
echo 'export CLAUDE_API_KEY="sua-key"' >> ~/.zshrc
```

4. **Inicia o servidor**:
```bash
cd ~/remote-agent
node server.js

# Ou via PM2 (recomendado):
pm2 start server.js --name remote-agent
pm2 save
```

5. **Expõe via Cloudflare Tunnel** (ou deixa na porta local):
```bash
# Adiciona ao config do tunnel (se já tem):
# ingress:
#   - hostname: agent.tdln.logline.world
#     service: http://localhost:3737
```

---

## Deploy Opção 1: Vercel (Recomendado)

### Vantagens:
- ✅ PWA funciona automaticamente
- ✅ HTTPS grátis
- ✅ CDN global (rápido de qualquer lugar)
- ✅ Deploy em 2 minutos

### Passos:

1. **Cria repo no GitHub**:
```bash
cd /Users/ubl-ops/setup256/realtime-messaging-app
git init
git add .
git commit -m "Initial commit - LAB 512 Remote Control"
gh repo create lab512-remote --public --source=. --push
```

2. **Deploy na Vercel**:
   - Vai em [vercel.com](https://vercel.com)
   - Import repository
   - Adiciona variável de ambiente:
     - `NEXT_PUBLIC_AGENT_URL` = `https://agent.tdln.logline.world` (ou IP do LAB 512)
   - Deploy! 🚀

3. **Instala no iPhone**:
   - Abre URL da Vercel no Safari
   - Toca em "Share" → "Add to Home Screen"
   - Pronto! Agora é app nativo 📱

---

## Deploy Opção 2: Self-hosted no LAB 256

### Vantagens:
- ✅ Totalmente controlado por você
- ✅ Sem dependências externas
- ✅ Funciona offline

### Passos:

1. **Build do app**:
```bash
cd /Users/ubl-ops/setup256/realtime-messaging-app
pnpm install
pnpm build
```

2. **Cria `.env.local`**:
```bash
echo "NEXT_PUBLIC_AGENT_URL=https://agent.tdln.logline.world" > .env.local
```

3. **Inicia via PM2**:
```bash
pm2 start pnpm --name lab512-ui -- start
pm2 save
```

4. **Expõe via Cloudflare Tunnel**:
```yaml
# config.yml do tunnel
ingress:
  - hostname: lab512.tdln.logline.world
    service: http://localhost:3000
  - hostname: agent.tdln.logline.world
    service: http://localhost:3737  # Remote Agent
```

5. **Instala no iPhone**:
   - Safari → https://lab512.tdln.logline.world
   - Add to Home Screen

---

## Deploy Opção 3: Cloudflare Pages

### Vantagens:
- ✅ Integração com Cloudflare Tunnel
- ✅ HTTPS grátis
- ✅ Workers para otimizar

### Passos:

1. **Push para GitHub** (mesmo do Opção 1)

2. **Cloudflare Pages**:
   - Dashboard → Pages → Create project
   - Connect GitHub
   - Build settings:
     - Framework: Next.js
     - Build command: `pnpm build`
     - Build output: `.next`
   - Environment variable:
     - `NEXT_PUBLIC_AGENT_URL` = URL do agent

3. **Deploy!**

---

## Testando Localmente (antes de deploy)

### Terminal 1 (LAB 512 Agent - via TeamViewer):
```bash
cd ~/remote-agent
node server.js
# Deve aparecer: "🤖 Remote Agent Server - LAB 512"
```

### Terminal 2 (Next.js App - LAB 256):
```bash
cd /Users/ubl-ops/setup256/realtime-messaging-app
echo "NEXT_PUBLIC_AGENT_URL=http://IP_DO_LAB_512:3737" > .env.local
pnpm dev
```

### Teste:
- Abre http://localhost:3000/chat
- Envia: "Olá! Qual o status do sistema?"
- Deve receber resposta do Claude no LAB 512

---

## Configuração PWA no iPhone

1. **Abre no Safari** (Chrome não funciona para PWA)
2. **Toca no botão Share** (quadrado com seta)
3. **"Add to Home Screen"**
4. **Nomeia**: "LAB 512"
5. **Pronto!** Ícone na home screen

### Dicas PWA:
- Funciona offline (cache básico)
- Sem barra de endereço (fullscreen)
- Notificações (se ativar)
- Instalável como app nativo

---

## Troubleshooting

### "Failed to connect to agent":
```bash
# Via TeamViewer no LAB 512:
pm2 logs remote-agent
# Verifica se está rodando

# Testa manualmente:
curl http://localhost:3737/health
```

### "CORS error":
O `server.js` já tem CORS habilitado (`Access-Control-Allow-Origin: *`).
Se continuar, adiciona explicitamente a origem:
```javascript
res.setHeader('Access-Control-Allow-Origin', 'https://seu-app.vercel.app')
```

### PWA não instala no iPhone:
- Usa **Safari** (não Chrome)
- Verifica se tem `manifest.json` válido
- Precisa de **HTTPS** (localhost funciona também)

---

## Próximos Passos

1. ✅ Deploy do backend (LAB 512 agent)
2. ✅ Deploy do frontend (Vercel/Cloudflare)
3. ✅ Instala PWA no iPhone
4. 🔜 Testa de Paris!
5. 🔜 Adiciona autenticação (opcional)
6. 🔜 Adiciona comandos favoritos (quick actions)

---

🗼 Pronto para controlar o LAB 512 de qualquer lugar! 🚀
