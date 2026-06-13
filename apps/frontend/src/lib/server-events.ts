import { onUnmounted, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { invalidateWorkspaceFs } from '@/modules/workspace/queries/invalidate-workspace-fs';

// Subscribes to the server's SSE stream, scoped to the worktree the user is
// currently viewing. Per-worktree topics (git-status / file-tree) for other
// worktrees never reach this client, so a busy background agent can't drive a
// refetch storm here. Global topics (sessions / worktrees) always arrive.
//
// The interest set is fixed per connection (EventSource URLs are immutable), so a
// change of active worktree tears down and reopens the stream with the new
// ?worktree= scope. Switches are infrequent and the new worktree's queries refetch
// on mount anyway, so the brief reconnect loses no state.
export function useServerEvents(
  activeWorktreeId: MaybeRefOrGetter<string | undefined>,
) {
  const qc = useQueryClient();
  let es: EventSource | null = null;

  function handleMessage(e: MessageEvent<string>) {
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
  }

  function connect(worktreeId: string | undefined) {
    es?.close();
    const url = worktreeId
      ? `/api/events?worktree=${encodeURIComponent(worktreeId)}`
      : '/api/events';
    es = new EventSource(url, { withCredentials: true });
    es.onmessage = handleMessage;
  }

  watch(() => toValue(activeWorktreeId), (id) => connect(id), { immediate: true });

  onUnmounted(() => es?.close());
}
