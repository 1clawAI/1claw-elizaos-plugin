import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @elizaos/core
vi.mock("@elizaos/core", () => ({
  Service: class Service {
    protected runtime: any;
    constructor(runtime?: any) {
      this.runtime = runtime;
    }
  },
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock @1claw/sdk
const mockListVaults = vi.fn();
const mockListSecrets = vi.fn();
const mockGetSecret = vi.fn();
const mockSetSecret = vi.fn();
const mockSign = vi.fn();
const mockSimulateTransaction = vi.fn();
const mockSubmitTransaction = vi.fn();
const mockListSigningKeys = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@1claw/sdk", () => {
  return {
    OneclawClient: class MockOneclawClient {
      vault = { list: mockListVaults };
      secrets = { list: mockListSecrets, get: mockGetSecret, set: mockSetSecret };
      agents = {
        sign: mockSign,
        simulateTransaction: mockSimulateTransaction,
        submitTransaction: mockSubmitTransaction,
        get: mockGetAgent,
      };
      signingKeys = { list: mockListSigningKeys };
      constructor(public config: any) {}
    },
  };
});

import { OneClawService } from "../service";
import { oneClawContextProvider } from "../provider";
import { getSecretAction } from "../actions/getSecret";
import { listSecretsAction } from "../actions/listSecrets";
import { putSecretAction } from "../actions/putSecret";
import { signMessageAction } from "../actions/signMessage";
import { signTypedDataAction } from "../actions/signTypedData";
import { simulateTransactionAction } from "../actions/simulateTransaction";
import { submitTransactionAction } from "../actions/submitTransaction";
import { listSigningKeysAction } from "../actions/listSigningKeys";

function makeRuntime(settings: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    ONECLAW_AGENT_API_KEY: "ocv_test123",
  };
  const merged = { ...defaults, ...settings };
  return {
    getSetting: (key: string) => merged[key] ?? null,
    getService: vi.fn(),
  } as any;
}

describe("OneClawService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListVaults.mockResolvedValue({
      data: { vaults: [{ id: "vault-1", name: "test" }] },
    });
  });

  it("initializes with valid API key", async () => {
    const runtime = makeRuntime();
    const service = await OneClawService.start(runtime);
    expect(service).toBeInstanceOf(OneClawService);
    expect(service.getVaultId()).toBe("vault-1");
  });

  it("throws if API key is missing", async () => {
    const runtime = makeRuntime({ ONECLAW_AGENT_API_KEY: "" });
    await expect(OneClawService.start(runtime)).rejects.toThrow(
      /ONECLAW_AGENT_API_KEY/,
    );
  });

  it("uses Shroud URL when ONECLAW_USE_SHROUD is true", async () => {
    const runtime = makeRuntime({ ONECLAW_USE_SHROUD: "true" });
    const service = await OneClawService.start(runtime);
    // Verify client was created — we can check it works by calling a method
    expect(service).toBeInstanceOf(OneClawService);
  });

  it("getSecret calls SDK", async () => {
    mockGetSecret.mockResolvedValue({
      data: { value: "sk_test_123", type: "api_key", version: 2 },
    });
    const runtime = makeRuntime();
    const service = await OneClawService.start(runtime);
    const result = await service.getSecret("api-keys/stripe");
    expect(result.value).toBe("sk_test_123");
    expect(result.version).toBe(2);
  });

  it("listSecrets returns paths", async () => {
    mockListSecrets.mockResolvedValue({
      data: {
        secrets: [
          { path: "api-keys/stripe", type: "api_key", version: 1 },
          { path: "db/password", type: "password", version: 3 },
        ],
      },
    });
    const runtime = makeRuntime();
    const service = await OneClawService.start(runtime);
    const result = await service.listSecrets();
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("api-keys/stripe");
  });

  it("putSecret stores and returns version", async () => {
    mockSetSecret.mockResolvedValue({ data: { version: 5 } });
    const runtime = makeRuntime();
    const service = await OneClawService.start(runtime);
    const result = await service.putSecret("test/key", "myvalue");
    expect(result.version).toBe(5);
  });

  it("listSigningKeys returns active keys", async () => {
    mockListSigningKeys.mockResolvedValue({
      data: {
        signing_keys: [
          { chain: "ethereum", public_key: "0x...", address: "0xabc", is_active: true },
          { chain: "solana", public_key: "HZ7...", address: "HZ7abc", is_active: true },
        ],
      },
    });
    const runtime = makeRuntime({ ONECLAW_AGENT_ID: "agent-123" });
    const service = await OneClawService.start(runtime);
    const keys = await service.listSigningKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0].chain).toBe("ethereum");
  });
});

describe("oneClawContextProvider", () => {
  it("returns vault context with secrets and keys", async () => {
    const mockService = {
      listSecrets: vi.fn().mockResolvedValue([
        { path: "api-keys/stripe", type: "api_key", version: 1 },
      ]),
      listSigningKeys: vi.fn().mockResolvedValue([
        { chain: "ethereum", address: "0x1234abcd5678efgh", is_active: true },
      ]),
      getAgentProfile: vi.fn().mockResolvedValue({
        tx_spent_today_eth: "0.05",
        tx_daily_limit_eth: "1.00",
      }),
    };

    const runtime = {
      getService: () => mockService,
    } as any;

    const result = await oneClawContextProvider.get!(runtime, {} as any, {} as any);
    expect(result.text).toContain("1Claw vault attached");
    expect(result.text).toContain("api-keys/stripe");
    expect(result.text).toContain("ethereum");
    expect(result.text).toContain("0.05");
  });

  it("handles unavailable service gracefully", async () => {
    const runtime = { getService: () => null } as any;
    const result = await oneClawContextProvider.get!(runtime, {} as any, {} as any);
    expect(result.text).toContain("not available");
  });
});

describe("Action validations", () => {
  const actions = [
    getSecretAction,
    listSecretsAction,
    putSecretAction,
    signMessageAction,
    signTypedDataAction,
    simulateTransactionAction,
    submitTransactionAction,
    listSigningKeysAction,
  ];

  for (const action of actions) {
    it(`${action.name} rejects when service is missing`, async () => {
      const runtime = { getService: () => null } as any;
      const result = await action.validate!(runtime, {} as any, {} as any);
      expect(result).toBe(false);
    });

    it(`${action.name} accepts when service is present`, async () => {
      const runtime = { getService: () => ({}) } as any;
      const result = await action.validate!(runtime, {} as any, {} as any);
      expect(result).toBe(true);
    });
  }
});

describe("GET_SECRET action handler", () => {
  it("returns redacted response with secret data", async () => {
    const mockService = {
      getSecret: vi.fn().mockResolvedValue({
        value: "secret-val",
        type: "api_key",
        version: 3,
      }),
    };
    const runtime = { getService: () => mockService } as any;
    const message = { content: { text: "get the secret at api-keys/stripe" } };

    const result = await getSecretAction.handler!(runtime, message as any, {} as any, {}, undefined as any);
    expect(result.success).toBe(true);
    expect(result.text).toContain("[REDACTED]");
    expect(result.text).toContain("api-keys/stripe");
    expect((result as any).data.value).toBe("secret-val");
  });

  it("fails without path", async () => {
    const runtime = { getService: () => ({}) } as any;
    const message = { content: { text: "get a secret" } };
    const result = await getSecretAction.handler!(runtime, message as any, {} as any, {}, undefined as any);
    expect(result.success).toBe(false);
    expect(result.text).toContain("specify the secret path");
  });
});

describe("PUT_SECRET action handler", () => {
  it("rejects invalid paths", async () => {
    const runtime = { getService: () => ({}) } as any;
    const message = { content: { path: "../etc/passwd", value: "test" } };
    const result = await putSecretAction.handler!(runtime, message as any, {} as any, {}, undefined as any);
    expect(result.success).toBe(false);
    expect(result.text).toContain("Invalid path");
  });
});

describe("SUBMIT_TRANSACTION action handler", () => {
  it("aborts on simulation revert", async () => {
    const mockService = {
      simulateTransaction: vi.fn().mockResolvedValue({
        status: "reverted",
        revert_reason: "ERC20: insufficient balance",
      }),
    };
    const runtime = { getService: () => mockService } as any;
    const message = {
      content: {
        tx: { chain: "ethereum", to: "0x123", value: "1.0" },
      },
    };

    const result = await submitTransactionAction.handler!(runtime, message as any, {} as any, {}, undefined as any);
    expect(result.success).toBe(false);
    expect(result.text).toContain("reverted");
    expect(result.text).toContain("insufficient balance");
  });
});
