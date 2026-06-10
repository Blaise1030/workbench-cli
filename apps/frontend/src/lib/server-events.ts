import { onUnmounted } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { invalidateWorkspaceFs } from '@/modules/workspace/queries/invalidate-workspace-fs';

export function useServerEvents() {
  const qc = useQueryClient();

  const es = new EventSource('/api/events', { withCredentials: true });

  es.onmessage = (e: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(e.data) as { topics?: string[] };
      for (const topic of msg.topics ?? []) {
        if (topic === 'sessions') {
          void qc.invalidateQueries({ queryKey: ['sessions'] });
        } else if (topic === 'worktrees') {
          void qc.invalidateQueries({ queryKey: ['workspace', 'worktrees'] });
          void qc.invalidateQueries({ queryKey: ['workspace', 'projects'] });
        } else if (topic.startsWith('git-status:')) {
          const worktreeId = topic.slice('git-status:'.length);
          void qc.invalidateQueries({ queryKey: ['workspace', 'git-status', worktreeId] });
          void qc.invalidateQueries({ queryKey: ['workspace', 'git-diff', worktreeId] });
        } else if (topic.startsWith('file-tree:')) {
          const worktreeId = topic.slice('file-tree:'.length);
          void invalidateWorkspaceFs(qc, worktreeId);
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  onUnmounted(() => es.close());
}
