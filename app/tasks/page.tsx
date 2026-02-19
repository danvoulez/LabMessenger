'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/utils/supabase/client'

type TaskStatus = 'completed' | 'approved' | 'pending' | 'rejected'

interface ConversationRow {
  id: string
  title: string
}

interface ProposalRow {
  id: string
  conversation_id: string
  content: string
  created_at: string
  task_id: string | null
  task_data: {
    title?: string
    description?: string
    steps?: string[]
    estimated_commands?: number
    risk_level?: 'low' | 'medium' | 'high'
    max_commands?: number
    commands_used?: number
  } | null
}

interface ExecutionRow {
  id: string
  conversation_id: string
  created_at: string
  task_id: string | null
  task_data: {
    max_commands?: number
    commands_used?: number
  } | null
}

interface DecisionRow {
  id: string
  content: string
  created_at: string
}

interface TaskItem {
  key: string
  taskId: string
  conversationTitle: string
  title: string
  description?: string
  steps: string[]
  estimatedCommands?: number
  riskLevel?: 'low' | 'medium' | 'high'
  status: TaskStatus
  createdAt: number
  updatedAt: number
  maxCommands?: number
  commandsUsed?: number
  proposalText: string
}

const STATUS_META: Record<TaskStatus, { label: string; dotClass: string }> = {
  completed: { label: 'Concluída', dotClass: 'bg-emerald-500' },
  approved: { label: 'Aprovada', dotClass: 'bg-amber-500' },
  pending: { label: 'Pendente', dotClass: 'bg-amber-500' },
  rejected: { label: 'Rejeitada', dotClass: 'bg-rose-500' },
}

function parseTaskIdFromCommand(raw: string, prefix: 'APPROVED' | 'REJECTED'): string | null {
  const text = raw.trim()
  if (!text.toUpperCase().startsWith(`${prefix}:`)) return null
  const payload = text.slice(text.indexOf(':') + 1).trim()
  if (!payload) return null
  const pieces = payload.split(':')
  return (pieces[0] || '').trim() || null
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TasksPage() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingTasks, setLoadingTasks] = useState(true)

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (!user?.id) return

    const loadTasks = async () => {
      setLoadingTasks(true)

      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('user_id', user.id)

      if (convError || !conversations || conversations.length === 0) {
        setTasks([])
        setLoadingTasks(false)
        return
      }

      const conversationRows = conversations as ConversationRow[]
      const conversationById = new Map(conversationRows.map((c) => [c.id, c.title || 'Sem título']))
      const conversationIds = conversationRows.map((c) => c.id)

      const [{ data: proposals }, { data: executions }, { data: decisions }] = await Promise.all([
        supabase
          .from('messages')
          .select('id, conversation_id, content, created_at, task_id, task_data')
          .in('conversation_id', conversationIds)
          .eq('message_type', 'task_proposal')
          .order('created_at', { ascending: false }),
        supabase
          .from('messages')
          .select('id, conversation_id, created_at, task_id, task_data')
          .in('conversation_id', conversationIds)
          .eq('message_type', 'task_execution')
          .order('created_at', { ascending: false }),
        supabase
          .from('messages')
          .select('id, content, created_at')
          .in('conversation_id', conversationIds)
          .eq('role', 'user')
          .or('content.ilike.APPROVED:%,content.ilike.REJECTED:%')
          .order('created_at', { ascending: false }),
      ])

      const executionByTaskId = new Map<string, ExecutionRow>()
      for (const execution of (executions || []) as ExecutionRow[]) {
        if (!execution.task_id || executionByTaskId.has(execution.task_id)) continue
        executionByTaskId.set(execution.task_id, execution)
      }

      const approvedTaskIds = new Set<string>()
      const rejectedTaskIds = new Set<string>()
      for (const decision of (decisions || []) as DecisionRow[]) {
        const approvedTaskId = parseTaskIdFromCommand(decision.content, 'APPROVED')
        if (approvedTaskId) {
          approvedTaskIds.add(approvedTaskId)
          continue
        }
        const rejectedTaskId = parseTaskIdFromCommand(decision.content, 'REJECTED')
        if (rejectedTaskId) rejectedTaskIds.add(rejectedTaskId)
      }

      const mappedTasks: TaskItem[] = ((proposals || []) as ProposalRow[]).map((proposal) => {
        const taskId = proposal.task_id || proposal.id
        const execution = executionByTaskId.get(taskId)
        const status: TaskStatus = rejectedTaskIds.has(taskId)
          ? 'rejected'
          : execution
            ? 'completed'
            : approvedTaskIds.has(taskId)
              ? 'approved'
              : 'pending'

        return {
          key: proposal.id,
          taskId,
          conversationTitle: conversationById.get(proposal.conversation_id) || 'Sem conversa',
          title: proposal.task_data?.title || 'Tarefa sem título',
          description: proposal.task_data?.description,
          steps: proposal.task_data?.steps || [],
          estimatedCommands: proposal.task_data?.estimated_commands,
          riskLevel: proposal.task_data?.risk_level,
          status,
          createdAt: new Date(proposal.created_at).getTime(),
          updatedAt: execution
            ? new Date(execution.created_at).getTime()
            : new Date(proposal.created_at).getTime(),
          maxCommands: execution?.task_data?.max_commands ?? proposal.task_data?.max_commands,
          commandsUsed: execution?.task_data?.commands_used ?? proposal.task_data?.commands_used,
          proposalText: proposal.content,
        }
      })

      setTasks(mappedTasks)
      setLoadingTasks(false)
    }

    loadTasks().catch(() => {
      setTasks([])
      setLoadingTasks(false)
    })
  }, [supabase, user?.id])

  if (isLoading) {
    return (
      <main className="flex items-center justify-center h-dvh bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </main>
    )
  }

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
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Tasks</h1>
          <p className="text-xs text-muted-foreground">Propostas e execuções dos agentes</p>
        </div>
      </header>

      <section className="safe-bottom flex-1 overflow-y-auto px-3 py-3">
        {loadingTasks ? (
          <div className="text-muted-foreground text-sm">Carregando tarefas...</div>
        ) : tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma tarefa encontrada.
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const isOpen = expanded.has(task.key)
              const status = STATUS_META[task.status]
              return (
                <article
                  key={task.key}
                  className="border border-border rounded-xl bg-card overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full px-3 py-3 text-left flex items-start gap-3"
                    onClick={() => toggleExpanded(task.key)}
                  >
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${status.dotClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground truncate">{task.title}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{status.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.conversationTitle} · {formatDate(task.createdAt)}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-border">
                      {task.description && (
                        <p className="text-sm text-foreground mb-2">{task.description}</p>
                      )}
                      {task.steps.length > 0 && (
                        <ul className="space-y-1 mb-3">
                          {task.steps.map((step, index) => (
                            <li key={`${task.key}-step-${index}`} className="text-sm text-foreground flex gap-2">
                              <span className="text-muted-foreground w-4 shrink-0">{index + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Comandos estimados: {task.estimatedCommands ?? '-'}</div>
                        <div>Risco: {task.riskLevel || '-'}</div>
                        <div>Máximo permitido: {task.maxCommands ?? '-'}</div>
                        <div>Usados: {task.commandsUsed ?? 0}</div>
                        <div className="col-span-2">Atualizado: {formatDate(task.updatedAt)}</div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
