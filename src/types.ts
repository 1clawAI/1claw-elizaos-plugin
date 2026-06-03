export interface OneClawConfig {
  agentApiKey: string;
  agentId?: string;
  vaultId?: string;
  baseUrl: string;
  useShroud: boolean;
}

export interface SecretEntry {
  path: string;
  type?: string;
  version?: number;
  expires_at?: string;
}

export interface SigningKey {
  chain: string;
  public_key: string;
  address: string;
  is_active: boolean;
}

export interface TransactionRequest {
  chain: string;
  to: string;
  value?: string;
  data?: string;
  gas_limit?: string;
  max_fee_per_gas?: string;
  max_priority_fee_per_gas?: string;
  gas_price?: string;
  nonce?: number;
}

export interface SimulationResult {
  simulation_id?: string;
  status: string;
  gas_used?: number;
  error?: string;
  revert_reason?: string;
  tenderly_dashboard_url?: string;
  [key: string]: unknown;
}

export interface TransactionResult {
  tx_hash?: string;
  signed_tx?: string;
  status: string;
  from?: string;
  [key: string]: unknown;
}

export interface SignMessageRequest {
  chain: string;
  message: string;
  signing_key_path?: string;
}

export interface SignTypedDataRequest {
  chain: string;
  typed_data: Record<string, unknown>;
  signing_key_path?: string;
}

export class OneClawAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneClawAuthError";
  }
}

export class OneClawPolicyDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneClawPolicyDeniedError";
  }
}

export class OneClawGuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneClawGuardrailError";
  }
}

export class OneClawNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneClawNotFoundError";
  }
}
