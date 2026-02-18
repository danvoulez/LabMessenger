/**
 * Estados granulares de processamento de mensagens
 * Para feedback visual detalhado ao usuário
 */
export enum MessageStatus {
  /** Usuário está digitando (local) */
  TYPING = 'typing',
  
  /** Enviando para Supabase */
  SENDING = 'sending',
  
  /** Buscando contexto/histórico */
  FETCHING_CONTEXT = 'context',
  
  /** Roteando para o agente remoto */
  ROUTING_TO_AGENT = 'routing',
  
  /** Claude API está processando (fase mais longa) */
  AGENT_THINKING = 'thinking',
  
  /** Executando comandos no servidor */
  EXECUTING = 'executing',
  
  /** Claude analisando outputs dos comandos */
  ANALYZING = 'analyzing',
  
  /** Mensagem completada com sucesso */
  COMPLETE = 'complete',
  
  /** Erro durante processamento */
  ERROR = 'error'
}

/**
 * Metadata adicional para tracking de performance
 */
export interface MessageStatusMetadata {
  status: MessageStatus
  startedAt?: number
  completedAt?: number
  elapsedMs?: number
  error?: string
}

/**
 * Labels amigáveis para cada status
 */
export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  [MessageStatus.TYPING]: 'Digitando...',
  [MessageStatus.SENDING]: 'Enviando mensagem...',
  [MessageStatus.FETCHING_CONTEXT]: 'Carregando contexto...',
  [MessageStatus.ROUTING_TO_AGENT]: 'Conectando ao agente...',
  [MessageStatus.AGENT_THINKING]: '🤖 Claude processando...',
  [MessageStatus.EXECUTING]: '⚙️ Executando comandos...',
  [MessageStatus.ANALYZING]: '📊 Analisando resultados...',
  [MessageStatus.COMPLETE]: 'Completo',
  [MessageStatus.ERROR]: 'Erro'
}

/**
 * Ícones para cada status (opcional)
 */
export const MESSAGE_STATUS_ICONS: Record<MessageStatus, string> = {
  [MessageStatus.TYPING]: '✏️',
  [MessageStatus.SENDING]: '📤',
  [MessageStatus.FETCHING_CONTEXT]: '🔍',
  [MessageStatus.ROUTING_TO_AGENT]: '🚀',
  [MessageStatus.AGENT_THINKING]: '🤖',
  [MessageStatus.EXECUTING]: '⚙️',
  [MessageStatus.ANALYZING]: '📊',
  [MessageStatus.COMPLETE]: '✅',
  [MessageStatus.ERROR]: '❌'
}
