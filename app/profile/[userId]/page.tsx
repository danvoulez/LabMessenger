'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, MessageCircle, Phone, RefreshCw, Video } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/utils/supabase/client'

type UserType = 'human' | 'llm' | 'computer'
type ServiceStatus = 'healthy' | 'warning' | 'critical'
type SandboxMode = 'permissive' | 'restricted'

interface UserProfileRow {
  user_id: string
  display_name: string
  nickname: string | null
  bio: string | null
  avatar_url: string | null
  user_type: UserType
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface ObservabilityServiceRow {
  id: string
  service_name: string
  status: ServiceStatus
  summary: string
  details: Record<string, unknown> | null
  updated_at: string
}

interface ConversationSettingsRow {
  id: string
  metadata: Record<string, unknown> | null
}

const PROFILE_TYPE_META: Record<UserType, { label: string; toneClass: string }> = {
  human: { label: 'Pessoa', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  llm: { label: 'Modelo de IA', toneClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  computer: { label: 'Agente de computador', toneClass: 'text-sky-700 bg-sky-50 border-sky-200' },
}

const SERVICE_STATUS_META: Record<ServiceStatus, { label: string; dotClass: string }> = {
  healthy: { label: 'Conectado', dotClass: 'bg-emerald-500' },
  warning: { label: 'Instável', dotClass: 'bg-amber-500' },
  critical: { label: 'Offline', dotClass: 'bg-rose-500' },
}

const SERVICE_LABELS: Record<string, string> = {
  'agent-server': 'Agente residente',
  'supabase-realtime': 'Canal de mensagens',
  'mcp-client': 'Ferramentas MCP',
  'sandbox-runner': 'Sandbox de execução',
  'sandbox-runtime': 'Sandbox de execução',
}

const SANDBOX_MODE_META: Record<SandboxMode, { label: string; helper: string }> = {
  permissive: {
    label: 'Pode muito',
    helper: 'Com menos bloqueios. O agente pode executar mais ações com menos fricção.',
  },
  restricted: {
    label: 'Mais restrito',
    helper: 'Com mais proteção. Prioriza confirmação explícita antes de ações sensíveis.',
  },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatUpdatedAt(timestamp: string): string {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatServiceName(serviceName: string): string {
  if (SERVICE_LABELS[serviceName]) return SERVICE_LABELS[serviceName]
  return serviceName
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function parseSandboxMode(metadata: Record<string, unknown> | null | undefined): SandboxMode {
  if (metadata?.sandbox_mode === 'permissive') return 'permissive'
  return 'restricted'
}

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams<{ userId: string }>()
  const searchParams = useSearchParams()
  const { user, isLoading, isAuthenticated } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [services, setServices] = useState<ObservabilityServiceRow[]>([])
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [modeConversationId, setModeConversationId] = useState<string | null>(null)
  const [conversationMetadata, setConversationMetadata] = useState<Record<string, unknown>>({})
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>('restricted')
  const [sandboxModeSaving, setSandboxModeSaving] = useState(false)
  const [sandboxModeFeedback, setSandboxModeFeedback] = useState<string | null>(null)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null)

  const targetUserId = useMemo(() => {
    if (!params?.userId) return ''
    return Array.isArray(params.userId) ? params.userId[0] : params.userId
  }, [params?.userId])

  const requestedConversationId = useMemo(() => {
    const value = searchParams.get('conversationId') || ''
    return value.trim()
  }, [searchParams])

  const isOwnProfile = !!user?.id && user.id === targetUserId

  const toggleExpandedService = useCallback((serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev)
      if (next.has(serviceId)) next.delete(serviceId)
      else next.add(serviceId)
      return next
    })
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (!targetUserId || !user?.id) return

    const loadProfile = async () => {
      setLoadingProfile(true)
      setSandboxModeFeedback(null)
      setRecoveryFeedback(null)

      const { data: profileRow } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, nickname, bio, avatar_url, user_type, metadata, created_at, updated_at')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (!profileRow) {
        setProfile(null)
        setServices([])
        setModeConversationId(null)
        setConversationMetadata({})
        setSandboxMode('restricted')
        setLoadingProfile(false)
        return
      }

      const typedProfile = profileRow as UserProfileRow
      setProfile(typedProfile)

      if (typedProfile.user_type === 'computer') {
        const { data: serviceRows } = await supabase
          .from('user_observability_services')
          .select('id, service_name, status, summary, details, updated_at')
          .eq('user_id', targetUserId)
          .order('updated_at', { ascending: false })

        setServices((serviceRows || []) as ObservabilityServiceRow[])

        if (user.id !== targetUserId) {
          let conversationRow: ConversationSettingsRow | null = null

          if (requestedConversationId) {
            const { data } = await supabase
              .from('conversations')
              .select('id, metadata')
              .eq('id', requestedConversationId)
              .eq('user_id', user.id)
              .eq('agent_user_id', targetUserId)
              .maybeSingle()

            conversationRow = (data as ConversationSettingsRow | null) ?? null
          }

          if (!conversationRow) {
            const { data } = await supabase
              .from('conversations')
              .select('id, metadata')
              .eq('user_id', user.id)
              .eq('agent_user_id', targetUserId)
              .order('updated_at', { ascending: false })
              .limit(1)

            conversationRow = ((data && data[0]) as ConversationSettingsRow | undefined) ?? null
          }

          if (conversationRow) {
            const nextMetadata = (conversationRow.metadata || {}) as Record<string, unknown>
            setModeConversationId(conversationRow.id)
            setConversationMetadata(nextMetadata)
            setSandboxMode(parseSandboxMode(nextMetadata))
          } else {
            setModeConversationId(null)
            setConversationMetadata({})
            setSandboxMode('restricted')
          }
        } else {
          setModeConversationId(null)
          setConversationMetadata({})
          setSandboxMode('restricted')
        }
      } else {
        setServices([])
        setModeConversationId(null)
        setConversationMetadata({})
        setSandboxMode('restricted')
      }

      setLoadingProfile(false)
    }

    loadProfile().catch(() => {
      setProfile(null)
      setServices([])
      setModeConversationId(null)
      setConversationMetadata({})
      setSandboxMode('restricted')
      setSandboxModeFeedback('Não foi possível carregar as configurações deste contato.')
      setRecoveryFeedback(null)
      setLoadingProfile(false)
    })
  }, [requestedConversationId, supabase, targetUserId, user?.id])

  const handleSandboxModeChange = useCallback(async (nextMode: SandboxMode) => {
    if (!user?.id || !targetUserId || !modeConversationId || sandboxModeSaving) return
    if (sandboxMode === nextMode) return

    const previousMode = sandboxMode
    setSandboxMode(nextMode)
    setSandboxModeSaving(true)
    setSandboxModeFeedback(null)

    const nextMetadata: Record<string, unknown> = {
      ...conversationMetadata,
      sandbox_mode: nextMode,
      sandbox_mode_updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('conversations')
      .update({ metadata: nextMetadata })
      .eq('id', modeConversationId)
      .eq('user_id', user.id)
      .eq('agent_user_id', targetUserId)

    if (error) {
      setSandboxMode(previousMode)
      setSandboxModeFeedback('Falha ao salvar modo. Tente novamente.')
      setSandboxModeSaving(false)
      return
    }

    setConversationMetadata(nextMetadata)
    setSandboxModeFeedback(`Modo salvo: ${SANDBOX_MODE_META[nextMode].label}.`)
    setSandboxModeSaving(false)
  }, [conversationMetadata, modeConversationId, sandboxMode, sandboxModeSaving, supabase, targetUserId, user?.id])

  const handleAttemptRecovery = useCallback(async () => {
    if (!user?.id || !targetUserId || !modeConversationId || recoveryLoading) return

    setRecoveryLoading(true)
    setRecoveryFeedback(null)

    const requestedAt = new Date().toISOString()
    const requestId = crypto.randomUUID()
    const nextMetadata: Record<string, unknown> = {
      ...conversationMetadata,
      wakeup_request: {
        request_id: requestId,
        requested_at: requestedAt,
        requested_by: user.id,
      },
    }

    const [conversationUpdate, messageInsert] = await Promise.all([
      supabase
        .from('conversations')
        .update({ metadata: nextMetadata })
        .eq('id', modeConversationId)
        .eq('user_id', user.id)
        .eq('agent_user_id', targetUserId),
      supabase
        .from('messages')
        .insert({
          conversation_id: modeConversationId,
          user_id: user.id,
          role: 'user',
          message_type: 'message',
          status: 'sent',
          content: '🩺 Pedido automático: tente recuperar sua conexão, valide ferramentas MCP e responda com diagnóstico curto.',
        }),
    ])

    if (conversationUpdate.error || messageInsert.error) {
      setRecoveryFeedback('Não foi possível enviar a tentativa de recuperação agora.')
      setRecoveryLoading(false)
      return
    }

    setConversationMetadata(nextMetadata)
    setRecoveryFeedback('Tentativa enviada. Quando reconectar, o agente deve responder com status.')
    setRecoveryLoading(false)
  }, [conversationMetadata, modeConversationId, recoveryLoading, supabase, targetUserId, user?.id])

  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-dvh bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </main>
    )
  }

  if (!profile && !loadingProfile) {
    return (
      <main className="flex flex-col h-dvh bg-background">
        <header className="safe-top safe-x sticky top-0 z-10 flex items-center gap-2 px-2 py-2 bg-card border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/chat')}
            className="shrink-0 h-10 w-10 rounded-full"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Perfil do contato</h1>
        </header>
        <section className="flex-1 flex items-center justify-center px-6 text-center text-muted-foreground">
          Perfil não encontrado ou sem acesso.
        </section>
      </main>
    )
  }

  const safeProfile = profile
  const typeMeta = safeProfile ? PROFILE_TYPE_META[safeProfile.user_type] : null
  const metadata = safeProfile?.metadata || {}
  const sandboxModeMeta = SANDBOX_MODE_META[sandboxMode]
  const agentServerService = services.find((service) => service.service_name === 'agent-server')
  const hasServiceIssues = services.length === 0 || services.some((service) => service.status !== 'healthy')
  const showRecoveryAction =
    safeProfile?.user_type === 'computer' && !isOwnProfile && !!modeConversationId && hasServiceIssues

  return (
    <main className="flex flex-col h-dvh bg-background">
      <header className="safe-top safe-x sticky top-0 z-10 flex items-center justify-between px-2 py-2 bg-card border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/chat')}
          className="shrink-0 h-10 w-10 rounded-full"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">Perfil do contato</h1>
        <div className="w-10" />
      </header>

      <section className="safe-bottom flex-1 overflow-y-auto px-4 py-5">
        {loadingProfile || !safeProfile ? (
          <div className="text-muted-foreground text-sm">Carregando perfil...</div>
        ) : (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <Avatar className="h-44 w-44 border border-border">
                <AvatarFallback className="text-4xl bg-muted text-muted-foreground">
                  {getInitials(safeProfile.display_name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-4xl font-bold tracking-tight">{safeProfile.display_name}</h2>
              <p className="text-muted-foreground text-xl">~{safeProfile.nickname || safeProfile.user_type}</p>
              {typeMeta && (
                <span className={`text-sm border rounded-full px-3 py-1 ${typeMeta.toneClass}`}>
                  {typeMeta.label}
                </span>
              )}
              {safeProfile.user_type === 'computer' && (
                <span className={`text-xs border rounded-full px-3 py-1 ${
                  agentServerService?.status === 'healthy'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}>
                  {agentServerService?.status === 'healthy'
                    ? 'Conectado: vai responder'
                    : 'Pode não responder agora'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl text-lg"
                onClick={() => router.push('/chat')}
              >
                <MessageCircle className="h-6 w-6" />
                Mensagem
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl text-lg" disabled>
                <Phone className="h-6 w-6" />
                Áudio
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl text-lg" disabled>
                <Video className="h-6 w-6" />
                Vídeo
              </Button>
            </div>

            <article className="rounded-2xl border border-border bg-card px-4 py-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {isOwnProfile ? 'Suas anotações' : 'Anotações'}
              </h3>
              <p className="text-foreground">{safeProfile.bio || 'Sem anotações por enquanto.'}</p>
            </article>

            {safeProfile.user_type === 'computer' && !isOwnProfile && (
              <article className="rounded-2xl border border-border bg-card px-4 py-4">
                <h3 className="text-sm font-medium text-muted-foreground">Modo de execução</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha o nível de liberdade desse agente para esta conversa.
                </p>

                {modeConversationId ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button
                        variant={sandboxMode === 'permissive' ? 'default' : 'outline'}
                        onClick={() => void handleSandboxModeChange('permissive')}
                        disabled={sandboxModeSaving}
                        className="rounded-xl"
                      >
                        Pode muito
                      </Button>
                      <Button
                        variant={sandboxMode === 'restricted' ? 'default' : 'outline'}
                        onClick={() => void handleSandboxModeChange('restricted')}
                        disabled={sandboxModeSaving}
                        className="rounded-xl"
                      >
                        Mais restrito
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{sandboxModeMeta.helper}</p>
                    {sandboxModeFeedback && (
                      <p className="text-xs text-muted-foreground mt-1">{sandboxModeFeedback}</p>
                    )}
                    {showRecoveryAction && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          onClick={() => void handleAttemptRecovery()}
                          disabled={recoveryLoading}
                          className="rounded-xl w-full sm:w-auto"
                        >
                          {recoveryLoading ? (
                            <>
                              <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                              Tentando resolver...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Tentar resolver
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Envia um pedido seguro para o agente se recuperar e confirmar o que voltou.
                        </p>
                      </div>
                    )}
                    {recoveryFeedback && (
                      <p className="text-xs text-muted-foreground mt-2">{recoveryFeedback}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Abra uma conversa com este agente para configurar o modo.
                  </p>
                )}
              </article>
            )}

            {safeProfile.user_type === 'computer' && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground px-1">
                  Sinais de operação
                </h3>
                {services.length === 0 ? (
                  <article className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                    Sem sinais técnicos ainda.
                  </article>
                ) : (
                  services.map((service) => {
                    const isOpen = expandedServices.has(service.id)
                    const statusMeta = SERVICE_STATUS_META[service.status]
                    const detailsEntries = Object.entries(service.details || {})
                    return (
                      <article key={service.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left flex items-start gap-3"
                          onClick={() => toggleExpandedService(service.id)}
                        >
                          <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${statusMeta.dotClass}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground truncate">{formatServiceName(service.service_name)}</p>
                              <span className="text-xs text-muted-foreground">{statusMeta.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Atualizado em {formatUpdatedAt(service.updated_at)}
                            </p>
                          </div>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
                            <p className="text-sm text-foreground">{service.summary || 'Sem resumo disponível.'}</p>
                            {detailsEntries.length > 0 && (
                              <div className="grid grid-cols-1 gap-1">
                                {detailsEntries.map(([key, value]) => (
                                  <div key={`${service.id}-${key}`} className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{key}:</span>{' '}
                                    {formatDetailValue(value)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })
                )}
              </section>
            )}

            {safeProfile.user_type === 'llm' && (
              <article className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Perfil do modelo</h3>
                <p className="text-sm">
                  <span className="text-muted-foreground">Modelo:</span>{' '}
                  <span className="text-foreground">{formatDetailValue(metadata.model)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Provedor:</span>{' '}
                  <span className="text-foreground">{formatDetailValue(metadata.provider)}</span>
                </p>
              </article>
            )}

            {safeProfile.user_type === 'human' && (
              <article className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Perfil da pessoa</h3>
                <p className="text-sm">
                  <span className="text-muted-foreground">Entrou em:</span>{' '}
                  <span className="text-foreground">{formatUpdatedAt(safeProfile.created_at)}</span>
                </p>
              </article>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
