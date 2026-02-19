'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskProposal {
  title: string;
  steps: string[];
  estimated_commands: number;
}

interface TaskApprovalCardProps {
  taskProposal: TaskProposal;
  taskId: string;
  onApprove: (taskId: string, maxCommands: number) => void;
  onReject: (taskId: string) => void;
}

export function TaskApprovalCard({
  taskProposal,
  taskId,
  onApprove,
  onReject,
}: TaskApprovalCardProps) {
  const [maxCommands, setMaxCommands] = useState(10);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    await onApprove(taskId, maxCommands);
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    await onReject(taskId);
    setLoading(false);
  };

  return (
    <article className="my-2 rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      <header className="bg-black px-3 py-2.5 flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate">Aprovação de tarefa</h3>
          <p className="text-[11px] text-zinc-400 truncate">{taskProposal.title}</p>
        </div>
        <button
          type="button"
          className="text-xs text-zinc-400 hover:text-white transition-colors"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Menos' : 'Detalhes'}
        </button>
      </header>

      <div className="bg-zinc-800 px-3 py-3">
        {expanded && (
          <ul className="space-y-1.5 mb-3 text-sm">
            {taskProposal.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-zinc-400 w-4 shrink-0">{index + 1}.</span>
                <span className="text-zinc-100">{step}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300 mb-3">
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5">
            Estimado: ~{taskProposal.estimated_commands}
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5">
            Limite: {maxCommands}
          </div>
        </div>

        <div className="mb-3">
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={maxCommands}
            onChange={(e) => setMaxCommands(Number(e.target.value))}
            className="w-full accent-white"
            disabled={loading}
          />
        </div>

        <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-300" />
          <span>Comandos serão executados no terminal do agente após aprovação.</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              'bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-60'
            )}
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprovar
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              'bg-zinc-950 text-zinc-100 border border-zinc-700 hover:bg-zinc-900 disabled:opacity-60'
            )}
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Rejeitar
          </button>
        </div>
      </div>
    </article>
  );
}
