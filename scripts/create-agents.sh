#!/bin/bash
# Script para criar contas de agent no Supabase
# Execute DEPOIS de rodar o schema SQL

echo "🤖 Criando contas de Agent no Supabase..."
echo ""

# Configuração
SUPABASE_URL="https://izwbwcdvdetfhghquqkv.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d2J3Y2R2ZGV0ZmhnaHF1cWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzExMzYsImV4cCI6MjA4NzAwNzEzNn0.VlOP6xy_DQeNbkxtaHR6fzMZD55u0Z0oyoDKn2_aqR0"

# Senha forte para agents (guarde bem!)
AGENT_PASSWORD="LAB-Agent-2026-Secure-Password-$(openssl rand -hex 16)"

echo "📝 Senha gerada para agents: $AGENT_PASSWORD"
echo "⚠️  GUARDE ESSA SENHA! Será usada pelos agents."
echo ""

# Função para criar agent
create_agent() {
  local EMAIL=$1
  local NAME=$2
  
  echo "🔄 Criando $NAME ($EMAIL)..."
  
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/signup" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${EMAIL}\",
      \"password\": \"${AGENT_PASSWORD}\",
      \"data\": {
        \"username\": \"${NAME}\",
        \"is_agent\": true
      }
    }")
  
  USER_ID=$(echo $RESPONSE | jq -r '.user.id')
  
  if [ "$USER_ID" != "null" ] && [ ! -z "$USER_ID" ]; then
    echo "   ✅ Criado! User ID: $USER_ID"
    echo "   export ${NAME}_USER_ID='$USER_ID'" >> .env.agents
  else
    echo "   ❌ Erro: $(echo $RESPONSE | jq -r '.error_description // .msg // "Unknown error"')"
  fi
  echo ""
}

# Cria arquivo .env.agents
echo "# Agent User IDs - Gerado em $(date)" > .env.agents
echo "AGENT_PASSWORD='$AGENT_PASSWORD'" >> .env.agents
echo "" >> .env.agents

# Cria os agents
create_agent "lab512@agent.local" "LAB512_AGENT"
create_agent "lab8gb@agent.local" "LAB8GB_AGENT"
create_agent "lab256@agent.local" "LAB256_AGENT"

echo "✅ Agents criados!"
echo ""
echo "📁 IDs salvos em: .env.agents"
echo "   Copie esse arquivo para cada LAB"
echo ""
echo "🔐 Cada agent precisa fazer login no servidor com:"
echo "   Email: lab512@agent.local"
echo "   Senha: (veja .env.agents)"
