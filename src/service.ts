import { Service, type IAgentRuntime, logger } from "@elizaos/core";
import { OneclawClient } from "@1claw/sdk";
import type {
  OneClawConfig,
  SecretEntry,
  SigningKey,
  TransactionRequest,
  SimulationResult,
  TransactionResult,
  SignMessageRequest,
  SignTypedDataRequest,
} from "./types";
import {
  OneClawAuthError,
  OneClawPolicyDeniedError,
  OneClawGuardrailError,
  OneClawNotFoundError,
} from "./types";

export class OneClawService extends Service {
  static serviceType = "oneclaw";
  capabilityDescription =
    "HSM-backed secrets vault and multi-chain signing via 1Claw";

  private client!: OneclawClient;
  private clawConfig!: OneClawConfig;
  private agentId: string | undefined;
  private vaultId: string | undefined;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<OneClawService> {
    const service = new OneClawService(runtime);
    await service.initialize();
    return service;
  }

  async stop(): Promise<void> {
    logger.info("[1claw] Service stopped");
  }

  private async initialize(): Promise<void> {
    const apiKey = this.runtime.getSetting("ONECLAW_AGENT_API_KEY");
    if (!apiKey) {
      throw new OneClawAuthError(
        "ONECLAW_AGENT_API_KEY is required. Get one at https://1claw.xyz/dashboard",
      );
    }

    const useShroud =
      String(this.runtime.getSetting("ONECLAW_USE_SHROUD")) === "true";
    const baseUrlSetting = this.runtime.getSetting("ONECLAW_BASE_URL");
    const baseUrl = baseUrlSetting
      ? String(baseUrlSetting)
      : useShroud
        ? "https://shroud.1claw.xyz"
        : "https://api.1claw.xyz";

    const agentIdSetting = this.runtime.getSetting("ONECLAW_AGENT_ID");
    const vaultIdSetting = this.runtime.getSetting("ONECLAW_VAULT_ID");

    this.clawConfig = {
      agentApiKey: String(apiKey),
      agentId: agentIdSetting ? String(agentIdSetting) : undefined,
      vaultId: vaultIdSetting ? String(vaultIdSetting) : undefined,
      baseUrl,
      useShroud,
    };

    this.client = new OneclawClient({
      baseUrl: this.clawConfig.baseUrl,
      apiKey: this.clawConfig.agentApiKey,
      agentId: this.clawConfig.agentId,
    });

    try {
      const vaults = await this.client.vault.list();
      const vaultList = (vaults.data as any)?.vaults ?? [];
      if (vaultList.length > 0 && !this.clawConfig.vaultId) {
        this.vaultId = vaultList[0].id;
      } else {
        this.vaultId = this.clawConfig.vaultId;
      }
      this.agentId = this.clawConfig.agentId ?? (this.client as any).agentId;
      logger.info(
        `[1claw] Service started — vault=${this.vaultId ?? "auto"}, agent=${this.agentId ?? "auto"}`,
      );
    } catch (err) {
      throw new OneClawAuthError(
        `Failed to connect to 1Claw: ${(err as Error).message}`,
      );
    }
  }

  getVaultId(): string {
    if (!this.vaultId) {
      throw new OneClawAuthError("No vault ID available — set ONECLAW_VAULT_ID");
    }
    return this.vaultId;
  }

  getAgentId(): string | undefined {
    return this.agentId;
  }

  async getSecret(
    path: string,
    vaultId?: string,
  ): Promise<{ value: string; type?: string; version?: number }> {
    const vid = vaultId ?? this.getVaultId();
    try {
      const res = await this.client.secrets.get(vid, path);
      return {
        value: (res.data as any)!.value,
        type: (res.data as any)!.type,
        version: (res.data as any)!.version,
      };
    } catch (err) {
      this.translateError(err);
    }
  }

  async listSecrets(prefix?: string, vaultId?: string): Promise<SecretEntry[]> {
    const vid = vaultId ?? this.getVaultId();
    try {
      const res = await this.client.secrets.list(vid, prefix);
      return ((res.data as any)?.secrets ?? []).map((s: any) => ({
        path: s.path,
        type: s.type,
        version: s.version,
        expires_at: s.expires_at,
      }));
    } catch (err) {
      this.translateError(err);
    }
  }

  async putSecret(
    path: string,
    value: string,
    opts?: { type?: string; expires_at?: string },
    vaultId?: string,
  ): Promise<{ version: number }> {
    const vid = vaultId ?? this.getVaultId();
    try {
      const res = await this.client.secrets.set(vid, path, value, {
        type: opts?.type,
        expires_at: opts?.expires_at,
      });
      return { version: (res.data as any)!.version };
    } catch (err) {
      this.translateError(err);
    }
  }

  async signMessage(
    req: SignMessageRequest,
  ): Promise<{ signature: string; from?: string }> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await this.client.agents.sign(agentId, {
        intent_type: "personal_sign",
        chain: req.chain,
        message: req.message,
        signing_key_path: req.signing_key_path,
      } as any);
      return {
        signature: (res.data as any)?.signature ?? "",
        from: (res.data as any)?.from,
      };
    } catch (err) {
      this.translateError(err);
    }
  }

  async signTypedData(
    req: SignTypedDataRequest,
  ): Promise<{ signature: string; from?: string }> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await this.client.agents.sign(agentId, {
        intent_type: "typed_data",
        chain: req.chain,
        typed_data: req.typed_data,
        signing_key_path: req.signing_key_path,
      } as any);
      return {
        signature: (res.data as any)?.signature ?? "",
        from: (res.data as any)?.from,
      };
    } catch (err) {
      this.translateError(err);
    }
  }

  async simulateTransaction(tx: TransactionRequest): Promise<SimulationResult> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await this.client.agents.simulateTransaction(agentId, tx as any);
      const d = res.data as any;
      return {
        simulation_id: d?.simulation_id,
        status: d?.status ?? "unknown",
        gas_used: d?.gas_used,
        error: d?.error,
        revert_reason: d?.revert_reason,
        tenderly_dashboard_url: d?.tenderly_dashboard_url,
      };
    } catch (err) {
      this.translateError(err);
    }
  }

  async submitTransaction(
    tx: TransactionRequest,
    idempotencyKey?: string,
  ): Promise<TransactionResult> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await this.client.agents.submitTransaction(
        agentId,
        tx as any,
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      const d = res.data as any;
      return {
        tx_hash: d?.tx_hash,
        signed_tx: d?.signed_tx,
        status: d?.status ?? "unknown",
        from: d?.from,
      };
    } catch (err) {
      this.translateError(err);
    }
  }

  async listSigningKeys(): Promise<SigningKey[]> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await this.client.signingKeys.list(agentId);
      return ((res.data as any)?.signing_keys ?? []).map((k: any) => ({
        chain: k.chain,
        public_key: k.public_key,
        address: k.address,
        is_active: k.is_active,
      }));
    } catch (err) {
      this.translateError(err);
    }
  }

  async getAgentProfile(): Promise<{ tx_spent_today?: string; tx_daily_limit?: string }> {
    const agentId = this.getAgentId();
    if (!agentId) return {};
    try {
      const res = await this.client.agents.get(agentId);
      const d = res.data as any;
      return {
        tx_spent_today: d?.tx_spent_today ?? d?.tx_spent_today_eth,
        tx_daily_limit: d?.tx_daily_limit ?? d?.tx_daily_limit_eth,
      };
    } catch {
      return {};
    }
  }

  private translateError(err: unknown): never {
    const e = err as any;
    const status = e?.status ?? e?.statusCode;
    const msg = e?.message ?? String(err);
    if (status === 401) throw new OneClawAuthError(msg);
    if (status === 403) {
      if (msg.includes("guardrail") || msg.includes("allowlist") || msg.includes("limit")) {
        throw new OneClawGuardrailError(msg);
      }
      throw new OneClawPolicyDeniedError(msg);
    }
    if (status === 404) throw new OneClawNotFoundError(msg);
    throw err;
  }
}
