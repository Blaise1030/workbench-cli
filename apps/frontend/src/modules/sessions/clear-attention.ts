export interface AckAttentionParams {
  /** Currently active terminal tab id, or null when none/non-terminal panel. */
  activeTerminalId: string | null;
  /** agentStatus of the active terminal, if known. */
  status: string | undefined;
  /** Whether the browser page is currently visible. */
  visible: boolean;
  /** Terminal id we already acked for the current attention episode. */
  lastAckedId: string | null;
}

/**
 * Decides whether to clear a terminal's needs_attention status right now.
 * Pure so it can be unit-tested without Vue/DOM.
 */
export function shouldAckAttention(params: AckAttentionParams): boolean {
  const { activeTerminalId, status, visible, lastAckedId } = params;
  if (!activeTerminalId) return false;
  if (!visible) return false;
  if (status !== "needs_attention") return false;
  if (lastAckedId === activeTerminalId) return false;
  return true;
}
