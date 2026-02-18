# ✅ Checklist de Deploy - LAB 512 Remote

## 📋 Pré-Voo (Antes de Viajar)

### 1. Supabase Setup ✅
- [x] Projeto criado: `izwbwcdvdetfhghquqkv.supabase.co`
- [ ] Schema SQL executado
  ```bash
  # Dashboard → SQL Editor → Cole supabase-schema.sql → Run
  ```
- [ ] Realtime habilitado
  ```bash
  # Dashboard → Database → Replication
  # ✅ messages (checkbox marcado)
  # ✅ conversations (checkbox marcado)
  ```

### 2. Teste Local (LAB 256)
- [ ] Dependências instaladas
  ```bash
  cd /Users/ubl-ops/setup256/realtime-messaging-app
  pnpm install
  ```
- [ ] PWA rodando
  ```bash
  pnpm dev
  # Abre http://localhost:3000
  ```
- [ ] Cadastro/Login funciona
  ```bash
  # http://localhost:3000/signup
  # Cria conta teste
  ```
- [ ] Página /agent carrega
  ```bash
  # http://localhost:3000/agent
  # Deve mostrar "Conectando ao LAB 512..."
  ```

### 3. Agent Local (LAB 256 - teste)
- [ ] Claude API Key configurada
  ```bash
  export CLAUDE_API_KEY='sk-ant-api03-...'
  ```
- [ ] Server rodando
  ```bash
  cd /Users/ubl-ops/setup256/remote-agent
  node server-persistent.js
  # ✅ Agent rodando em http://localhost:3737
  ```
- [ ] Health check OK
  ```bash
  curl http://localhost:3737/health | jq
  # {"status":"ok", ...}
  ```

### 4. Teste End-to-End Local
- [ ] Envia mensagem teste
  ```bash
  # http://localhost:3000/agent
  # Digita: "qual seu hostname?"
  ```
- [ ] Recebe resposta
  ```bash
  # Deve aparecer resposta do Claude com hostname
  ```
- [ ] Comando executa
  ```bash
  # Digita: "ls -la ~"
  # Deve mostrar output do comando
  ```

---

## 🚀 Deploy Agent no LAB 512

### 5. Preparar Agent (LAB 256)
- [ ] Compactar pasta
  ```bash
  cd /Users/ubl-ops/setup256
  tar -czf remote-agent.tar.gz remote-agent/
  ```

### 6. Transferir via TeamViewer (LAB 512)
- [ ] Abrir TeamViewer
  ```bash
  # Conecta no LAB 512
  ```
- [ ] Criar pasta
  ```bash
  # No LAB 512
  mkdir -p ~/remote-agent
  cd ~/remote-agent
  ```
- [ ] Transferir arquivo
  ```bash
  # TeamViewer → Files → Upload remote-agent.tar.gz
  ```
- [ ] Extrair
  ```bash
  # No LAB 512
  cd ~
  tar -xzf remote-agent.tar.gz
  cd remote-agent
  ```

### 7. Configurar Agent (LAB 512)
- [ ] Criar .env
  ```bash
  # No LAB 512
  cd ~/remote-agent
  cat > .env << 'EOF'
  CLAUDE_API_KEY=sk-ant-api03-...
  PORT=3737
  EOF
  ```
- [ ] Testar local
  ```bash
  node server-persistent.js
  # Ctrl+C para parar
  ```

### 8. PM2 Setup (LAB 512)
- [ ] Instalar PM2 (se não tiver)
  ```bash
  npm install -g pm2
  ```
- [ ] Iniciar agent
  ```bash
  cd ~/remote-agent
  pm2 start server-persistent.js --name lab512-agent
  ```
- [ ] Verificar status
  ```bash
  pm2 status
  # lab512-agent │ online
  ```
- [ ] Salvar configuração
  ```bash
  pm2 save
  pm2 startup
  # Copia e roda o comando que aparecer
  ```

### 9. Cloudflare Tunnel (LAB 512)
- [ ] Verificar tunnel existente
  ```bash
  cloudflared tunnel list
  ```
- [ ] Criar/atualizar config
  ```bash
  cat > ~/.cloudflared/config.yml << 'EOF'
  tunnel: <seu-tunnel-id>
  credentials-file: ~/.cloudflared/<seu-tunnel-id>.json
  
  ingress:
    - hostname: agent.tdln.logline.world
      service: http://localhost:3737
    - service: http_status:404
  EOF
  ```
- [ ] Iniciar tunnel
  ```bash
  pm2 start cloudflared --name tunnel -- tunnel run
  pm2 save
  ```
- [ ] Testar externamente
  ```bash
  # No LAB 256
  curl https://agent.tdln.logline.world/health | jq
  ```

---

## 🌐 Deploy PWA

### 10. Deploy no Vercel
- [ ] Push para GitHub
  ```bash
  cd /Users/ubl-ops/setup256/realtime-messaging-app
  git init
  git add .
  git commit -m "LAB 512 Remote Control"
  gh repo create lab512-remote --private --push --source=.
  ```
- [ ] Importar no Vercel
  ```bash
  # vercel.com → New Project → Import lab512-remote
  ```
- [ ] Configurar variáveis
  ```bash
  # Vercel → Settings → Environment Variables
  NEXT_PUBLIC_SUPABASE_URL=https://izwbwcdvdetfhghquqkv.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
  NEXT_PUBLIC_AGENT_URL=https://agent.tdln.logline.world
  ```
- [ ] Deploy
  ```bash
  # Vercel faz deploy automático
  # URL: https://lab512-remote.vercel.app
  ```

### 11. Teste Remoto
- [ ] Acessa URL
  ```bash
  # https://lab512-remote.vercel.app
  ```
- [ ] Login funciona
- [ ] /agent carrega
- [ ] Envia mensagem teste
- [ ] Recebe resposta do LAB 512

---

## 📱 Instalar no iPhone

### 12. PWA no iPhone
- [ ] Safari → Abre PWA
  ```
  https://lab512-remote.vercel.app
  ```
- [ ] Login
- [ ] Share → Add to Home Screen
- [ ] Nome: "LAB 512"
- [ ] Abrir do Home Screen
- [ ] Teste envio de mensagem

---

## 🧪 Testes em Paris

### 13. Validação Remota
- [ ] Conecta WiFi hotel
- [ ] Abre PWA do Home Screen
- [ ] Envia: "uptime"
- [ ] Envia: "pm2 list"
- [ ] Envia: "df -h"
- [ ] Envia: "git status" (em algum repo)

### 14. Troubleshooting
- [ ] Se não conectar: verifica Cloudflare Tunnel
  ```bash
  # TeamViewer → LAB 512
  pm2 logs tunnel
  ```
- [ ] Se agent não responde: verifica PM2
  ```bash
  pm2 logs lab512-agent
  pm2 restart lab512-agent
  ```
- [ ] Se Supabase erro: verifica RLS policies
  ```sql
  -- Dashboard → SQL Editor
  SELECT * FROM messages WHERE conversation_id = 'lab512-remote';
  ```

---

## 🎯 Status Atual

```bash
✅ Código completo
✅ Supabase projeto criado
✅ Credenciais configuradas (.env.local)
⏳ Schema SQL (próximo passo!)
⏳ Agent no LAB 512
⏳ Cloudflare Tunnel
⏳ Deploy PWA
⏳ iPhone install
```

---

## 🚨 Backup Plan (Se algo falhar)

### Fallback 1: TeamViewer direto
- Sempre funciona, mas menos conveniente

### Fallback 2: Agent local no 256
- Leva o 256 pra Paris
- Roda agent local
- Acessa via localhost

### Fallback 3: SSH com retry
- Tenta SSH via Cloudflare novamente
- `ssh -o "ServerAliveInterval=60" user@ssh512.api.ubl.agency`

---

## 📞 Comandos Úteis em Paris

### Status geral
```bash
# No PWA
"pm2 status"
"uptime"
"df -h"
"ps aux | grep node"
```

### Restart agent
```bash
"pm2 restart lab512-agent"
```

### Ver logs
```bash
"pm2 logs lab512-agent --lines 50"
```

### Git operations
```bash
"cd ~/projeto && git pull"
"cd ~/projeto && git status"
```

### System info
```bash
"sw_vers"              # macOS version
"system_profiler SPHardwareDataType"  # Hardware
"networksetup -listallhardwareports"  # Network
```

---

**Próximo passo**: Executar schema SQL no Supabase! 🚀
