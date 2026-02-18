import { useState, useCallback } from 'react'

/**
 * Hook para optimistic task approval
 * Mostra feedback instantâneo enquanto aguarda resposta do servidor
 */
export function useOptimisticTaskApproval() {
  const [optimisticState, setOptimisticState] = useState<{
    taskId: string | null
    status: 'idle' | 'approving' | 'rejecting' | 'executing'
    error: string | null
  }>({
    taskId: null,
    status: 'idle',
    error: null
  })

  /**
   * Aprova task com feedback otimista
   * UI atualiza IMEDIATAMENTE, servidor processa em background
   */
  const approveTask = useCallback(async (
    taskId: string,
    maxCommands: number,
    onApprove: (taskId: string, maxCommands: number) => Promise<void>,
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => {
    // 1. UI otimista: mostra "aprovando..." IMEDIATAMENTE
    setOptimisticState({
      taskId,
      status: 'approving',
      error: null
    })

    try {
      // 2. Chama API em paralelo (não bloqueia UI)
      await onApprove(taskId, maxCommands)

      // 3. Sucesso: muda para "executando"
      setOptimisticState({
        taskId,
        status: 'executing',
        error: null
      })

      onSuccess?.()

    } catch (error) {
      // 4. Erro: reverte estado otimista
      setOptimisticState({
        taskId,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Erro ao aprovar tarefa'
      })

      onError?.(error as Error)
    }
  }, [])

  /**
   * Rejeita task com feedback otimista
   */
  const rejectTask = useCallback(async (
    taskId: string,
    onReject: (taskId: string) => Promise<void>,
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => {
    // UI otimista
    setOptimisticState({
      taskId,
      status: 'rejecting',
      error: null
    })

    try {
      await onReject(taskId)
      
      setOptimisticState({
        taskId: null,
        status: 'idle',
        error: null
      })

      onSuccess?.()

    } catch (error) {
      setOptimisticState({
        taskId,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Erro ao rejeitar tarefa'
      })

      onError?.(error as Error)
    }
  }, [])

  /**
   * Reseta estado (útil após task completada)
   */
  const reset = useCallback(() => {
    setOptimisticState({
      taskId: null,
      status: 'idle',
      error: null
    })
  }, [])

  return {
    optimisticState,
    approveTask,
    rejectTask,
    reset,
    isApproving: optimisticState.status === 'approving',
    isRejecting: optimisticState.status === 'rejecting',
    isExecuting: optimisticState.status === 'executing',
    isProcessing: optimisticState.status !== 'idle'
  }
}

/**
 * Exemplo de uso:
 * 
 * ```tsx
 * function TaskApprovalCard({ taskId, onApprove, onReject }) {
 *   const { 
 *     optimisticState, 
 *     approveTask, 
 *     rejectTask, 
 *     isApproving,
 *     isExecuting
 *   } = useOptimisticTaskApproval()
 * 
 *   const handleApprove = async () => {
 *     await approveTask(
 *       taskId,
 *       maxCommands,
 *       onApprove, // função real que chama API
 *       () => console.log('Aprovado!'),
 *       (err) => console.error(err)
 *     )
 *   }
 * 
 *   return (
 *     <div>
 *       {isApproving && <div>✨ Aprovando...</div>}
 *       {isExecuting && <div>⚙️ Executando comandos...</div>}
 *       
 *       <button onClick={handleApprove} disabled={isApproving}>
 *         {isApproving ? 'Aprovando...' : 'Aprovar'}
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
