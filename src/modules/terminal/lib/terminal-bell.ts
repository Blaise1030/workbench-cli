let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Short terminal-style beep for successful command completion. */
export function playTerminalBell(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const play = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + 0.12);
  };

  if (ctx.state === "suspended") {
    void ctx.resume().then(play);
  } else {
    play();
  }
}

export function notifyCommandSuccess(tabLabel: string): void {
  if (typeof document === "undefined" || !document.hidden) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification("Command finished", { body: tabLabel, tag: "lan-terminal-command" });
    return;
  }
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}
