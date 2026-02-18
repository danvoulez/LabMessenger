import React from 'react'

/**
 * Skeleton para mensagem carregando
 * Mostra enquanto aguarda resposta do agente
 */
export function SkeletonMessage({ variant = 'default' }: { variant?: 'default' | 'card' }) {
  if (variant === 'card') {
    return (
      <div className="animate-pulse space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        
        {/* Content lines */}
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-4/6 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        
        {/* Steps */}
        <div className="space-y-2 pt-2">
          <div className="h-6 w-full rounded bg-gray-100 dark:bg-gray-900" />
          <div className="h-6 w-full rounded bg-gray-100 dark:bg-gray-900" />
          <div className="h-6 w-3/4 rounded bg-gray-100 dark:bg-gray-900" />
        </div>
        
        {/* Button */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-9 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    )
  }

  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-4/6 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

/**
 * Skeleton para comando executando
 */
export function SkeletonCommand() {
  return (
    <div className="animate-pulse space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Command line */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400">$</span>
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-4 animate-pulse rounded-full bg-blue-500" />
      </div>
      
      {/* Output lines */}
      <div className="space-y-1 pl-4">
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  )
}

/**
 * Skeleton para lista de conversas
 */
export function SkeletonConversationList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton com animação de shimmer (efeito mais bonito)
 */
export function SkeletonMessageWithShimmer() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-gray-700/20" />
      
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}
