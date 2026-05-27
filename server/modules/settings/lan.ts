import { createInvite, type InviteToken } from "../auth/invite.js";
import type { LanPublicState } from "../../schemas/api.js";
import type { TransportScheme } from "../../transport.js";

export type BindMode = "localhost" | "lan";
export type { LanPublicState };

export class LanManager {
  mode: BindMode = "localhost";
  private invite: InviteToken | null = null;
  private lanIP: string | null = null;
  private urlScheme: TransportScheme = "https";

  constructor(private readonly port: number) {}

  setUrlScheme(scheme: TransportScheme): void {
    this.urlScheme = scheme;
  }

  enable(lanIP: string): void {
    this.mode = "lan";
    this.lanIP = lanIP;
    this.invite = createInvite();
  }

  disable(): void {
    this.mode = "localhost";
    this.lanIP = null;
    this.invite = null;
  }

  refreshInvite(): InviteToken {
    if (this.mode !== "lan" || !this.lanIP) {
      throw new Error("LAN is not enabled");
    }
    this.invite = createInvite();
    return this.invite;
  }

  getInvite(): InviteToken | null {
    return this.invite;
  }

  getHostname(): string {
    return this.mode === "lan" ? "0.0.0.0" : "127.0.0.1";
  }

  getTlsHosts(): string[] {
    return this.mode === "lan" && this.lanIP
      ? ["localhost", this.lanIP]
      : ["localhost"];
  }

  getPublicState(): LanPublicState {
    if (this.mode !== "lan" || !this.lanIP || !this.invite) {
      return { enabled: false };
    }
    return {
      enabled: true,
      lanUrl: `${this.urlScheme}://${this.lanIP}:${this.port}/?invite=${this.invite.value}`,
      inviteExpiresAt: this.invite.expiresAt,
    };
  }
}
