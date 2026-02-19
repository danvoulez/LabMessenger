'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, MessageCircle, Phone, Video } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/utils/supabase/client'

type UserType = 'human' | 'llm' | 'computer'
type ServiceStatus = 'healthy' | 'warning' | 'critical'

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

const PROFILE_TYPE_META: Record<UserType, { label: string; toneClass: string }> = {
  human: { label: 'Human', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  llm: { label: 'LLM', toneClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  computer: { label: 'Computer', toneClass: 'text-sky-700 bg-sky-50 border-sky-200' },
}

const SERVICE_STATUS_META: Record<ServiceStatus, { label: string; dotClass: string }> = {
  healthy: { label: 'Healthy', dotClass: 'bg-emerald-500' },
  warning: { label: 'Warning', dotClass: 'bg-amber-500' },
  critical: { label: 'Critical', dotClass: 'bg-rose-500' },
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

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams<{ userId: string }>()
  const { user, isLoading, isAuthenticated } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [services, setServices] = useState<ObservabilityServiceRow[]>([])
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [loadingProfile, setLoadingProfile] = useState(true)

  const targetUserId = useMemo(() => {
    if (!params?.userId) return ''
    return Array.isArray(params.userId) ? params.userId[0] : params.userId
  }, [params?.userId])

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

      const { data: profileRow } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, nickname, bio, avatar_url, user_type, metadata, created_at, updated_at')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (!profileRow) {
        setProfile(null)
        setServices([])
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
      } else {
        setServices([])
      }

      setLoadingProfile(false)
    }

    loadProfile().catch(() => {
      setProfile(null)
      setServices([])
      setLoadingProfile(false)
    })
  }, [supabase, targetUserId, user?.id])

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
          <h1 className="text-xl font-semibold text-foreground">Contact info</h1>
        </header>
        <section className="flex-1 flex items-center justify-center px-6 text-center text-muted-foreground">
          Profile not found or access denied.
        </section>
      </main>
    )
  }

  const safeProfile = profile
  const typeMeta = safeProfile ? PROFILE_TYPE_META[safeProfile.user_type] : null
  const metadata = safeProfile?.metadata || {}

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
        <h1 className="text-2xl font-semibold text-foreground">Contact info</h1>
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl text-lg"
                onClick={() => router.push('/chat')}
              >
                <MessageCircle className="h-6 w-6" />
                Message
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl text-lg" disabled>
                <Phone className="h-6 w-6" />
                Audio
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl text-lg" disabled>
                <Video className="h-6 w-6" />
                Video
              </Button>
            </div>

            <article className="rounded-2xl border border-border bg-card px-4 py-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {isOwnProfile ? 'Your notes' : 'Notes'}
              </h3>
              <p className="text-foreground">{safeProfile.bio || 'No notes yet.'}</p>
            </article>

            {safeProfile.user_type === 'computer' && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground px-1">
                  Observability services
                </h3>
                {services.length === 0 ? (
                  <article className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                    No service checks yet.
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
                              <p className="font-medium text-foreground truncate">{service.service_name}</p>
                              <span className="text-xs text-muted-foreground">{statusMeta.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Updated {formatUpdatedAt(service.updated_at)}
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
                            <p className="text-sm text-foreground">{service.summary || 'No summary provided.'}</p>
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
                <h3 className="text-sm font-medium text-muted-foreground">LLM profile</h3>
                <p className="text-sm">
                  <span className="text-muted-foreground">Model:</span>{' '}
                  <span className="text-foreground">{formatDetailValue(metadata.model)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Provider:</span>{' '}
                  <span className="text-foreground">{formatDetailValue(metadata.provider)}</span>
                </p>
              </article>
            )}

            {safeProfile.user_type === 'human' && (
              <article className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Human profile</h3>
                <p className="text-sm">
                  <span className="text-muted-foreground">Joined:</span>{' '}
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
