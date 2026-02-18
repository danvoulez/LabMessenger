'use client';

import { useState } from 'react';

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
    <div className="my-4 border-2 border-primary rounded-lg p-4 bg-card shadow-lg">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🤖</span>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">
            Aprovação de Tarefa
          </h3>
          <p className="text-sm text-muted-foreground">
            O agente precisa da sua aprovação para executar esta operação
          </p>
        </div>
      </div>

      {/* Título da Tarefa */}
      <div className="mb-3">
        <h4 className="font-semibold text-foreground text-base mb-1">
          {taskProposal.title}
        </h4>
      </div>

      {/* Steps */}
      <div className="mb-4">
        <p className="text-sm font-medium text-foreground mb-2">
          Passos a executar:
        </p>
        <ul className="space-y-1.5">
          {taskProposal.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary font-mono">#{index + 1}</span>
              <span className="text-foreground">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Estimativa */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Comandos estimados:</span>
        <span className="font-bold text-foreground">
          ~{taskProposal.estimated_commands}
        </span>
      </div>

      {/* Limite de Comandos */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-2">
          Limite de comandos permitidos:
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={maxCommands}
            onChange={(e) => setMaxCommands(Number(e.target.value))}
            className="flex-1 accent-primary"
            disabled={loading}
          />
          <span className="font-bold text-lg text-foreground min-w-[3ch]">
            {maxCommands}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          O agente será bloqueado após {maxCommands} comandos executados
        </p>
      </div>

      {/* Aviso */}
      <div className="mb-4 p-3 bg-muted border border-border rounded">
        <p className="text-xs text-muted-foreground">
          ⚠️ <strong>Atenção:</strong> Comandos serão executados no terminal
          do agente. Revise os passos antes de aprovar.
        </p>
      </div>

      {/* Botões */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Aprovando...
            </>
          ) : (
            <>
              <span>✅</span>
              Aprovar Tarefa
            </>
          )}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex-1 bg-secondary hover:bg-accent disabled:opacity-50 text-secondary-foreground font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Rejeitando...
            </>
          ) : (
            <>
              <span>❌</span>
              Rejeitar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
