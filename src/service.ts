import { Service, type IAgentRuntime, logger } from "@elizaos/core";
import { OneclawClient, type OneclawResponse } from "@1claw/sdk";
import type {
  OneClawConfig,
  SecretEntry,
  SigningKey,
  TransactionRequest,
  SimulationResult,
  TransactionResult,
  SignMessageRequest,
  SignTypedDataRequest,
  ExecuteHttpRequest,
  ExecuteHttpResult,
  BindingEntry,
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
        "ONECLAW_AGENT_API_KEY is required. Get one at https://1claw.co/dashboard",
      );
    }

    const useShroud =
      String(this.runtime.getSetting("ONECLAW_USE_SHROUD")) === "true";
    const baseUrlSetting = this.runtime.getSetting("ONECLAW_BASE_URL");
    const baseUrl = baseUrlSetting
      ? String(baseUrlSetting)
      : useShroud
        ? "https://shroud.1claw.co"
        : "https://api.1claw.co";

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
      const vaults = this.unwrap(await this.client.vault.list());
      const vaultList = (vaults as any)?.vaults ?? [];
      if (vaultList.length > 0 && !this.clawConfig.vaultId) {
        this.vaultId = vaultList[0].id;
      } else {
        this.vaultId = this.clawConfig.vaultId;
      }
      // The agent ID the ocv_ key exchanged for; vault.list() above did the exchange.
      this.agentId = this.clawConfig.agentId ?? this.client.http.resolvedAgentId;
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
      const d = this.unwrap(await this.client.secrets.get(vid, path)) as any;
      return { value: d.value, type: d.type, version: d.version };
    } catch (err) {
      this.translateError(err);
    }
  }

  async listSecrets(prefix?: string, vaultId?: string): Promise<SecretEntry[]> {
    const vid = vaultId ?? this.getVaultId();
    try {
      const d = this.unwrap(await this.client.secrets.list(vid, prefix)) as any;
      return (d?.secrets ?? []).map((s: any) => ({
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
      const d = this.unwrap(
        await this.client.secrets.set(vid, path, value, {
          type: opts?.type,
          expires_at: opts?.expires_at,
        }),
      ) as any;
      return { version: d.version };
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
      const d = this.unwrap(res) as any;
      return { signature: d?.signature ?? "", from: d?.from };
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
      const d = this.unwrap(res) as any;
      return { signature: d?.signature ?? "", from: d?.from };
    } catch (err) {
      this.translateError(err);
    }
  }

  async simulateTransaction(tx: TransactionRequest): Promise<SimulationResult> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const d = this.unwrap(
        await this.client.agents.simulateTransaction(agentId, tx as any),
      ) as any;
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
      const d = this.unwrap(
        await this.client.agents.submitTransaction(
          agentId,
          tx as any,
          idempotencyKey ? { idempotencyKey } : undefined,
        ),
      ) as any;
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
      // GET /v1/agents/{id}/signing-keys answers { keys: [...] }.
      const d = this.unwrap(await this.client.signingKeys.list(agentId)) as any;
      return (d?.keys ?? []).map((k: any) => ({
        chain: k.chain,
        public_key: k.public_key,
        address: k.address,
        is_active: k.is_active,
      }));
    } catch (err) {
      this.translateError(err);
    }
  }

  async executeHttp(req: ExecuteHttpRequest): Promise<ExecuteHttpResult> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await (this.client as any).http.request(
        "POST",
        `/v1/agents/${agentId}/execute`,
        {
          body: {
            binding: req.binding,
            intent_type: "http",
            execution_mode: req.execution_mode ?? "vault",
            params: {
              method: req.method ?? "GET",
              path: req.path ?? "",
              headers: req.headers,
              body: req.body,
            },
          },
        },
      );
      // { execution_id, status, result: { status, headers, body }, error }
      const d = this.unwrap(res) as any;
      if (d?.error && !d?.result) {
        throw new Error(`execute ${d.status ?? "failed"}: ${d.error}`);
      }
      const r = d?.result ?? {};
      return {
        status_code: r.status ?? r.status_code ?? 0,
        headers: r.headers,
        body: r.body,
        execution_id: d?.execution_id,
        execution_status: d?.status,
      };
    } catch (err) {
      this.translateError(err);
    }
  }

  async listBindings(): Promise<BindingEntry[]> {
    const agentId = this.getAgentId();
    if (!agentId) throw new OneClawAuthError("Agent ID not resolved");
    try {
      const res = await (this.client as any).http.request(
        "GET",
        `/v1/agents/${agentId}/bindings`,
      );
      const d = this.unwrap(res) as any;
      return (d?.bindings ?? []).map((b: any) => ({
        id: b.id,
        name: b.name,
        binding_type: b.binding_type,
        base_url: b.config?.base_url ?? b.base_url,
        is_active: b.is_active ?? true,
      }));
    } catch (err) {
      this.translateError(err);
    }
  }

  async getAgentProfile(): Promise<{ tx_spent_today?: string; tx_daily_limit?: string }> {
    const agentId = this.getAgentId();
    if (!agentId) return {};
    try {
      const d = this.unwrap(await this.client.agents.get(agentId)) as any;
      return {
        tx_spent_today: d?.tx_spent_today ?? d?.tx_spent_today_eth,
        tx_daily_limit: d?.tx_daily_limit ?? d?.tx_daily_limit_eth,
      };
    } catch {
      return {};
    }
  }

  /**
   * The SDK returns `{ data, error, meta }` and does not throw. Turn an error
   * envelope into a thrown `{ status, message }` so translateError can map it.
   */
  private unwrap<T>(res: OneclawResponse<T>): T {
    if (res.error) {
      throw Object.assign(new Error(res.error.detail ?? res.error.message), {
        status: res.meta?.status,
      });
    }
    return res.data as T;
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
