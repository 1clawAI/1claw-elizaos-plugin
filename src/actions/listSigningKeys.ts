import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const listSigningKeysAction: Action = {
  name: "LIST_SIGNING_KEYS",
  description:
    "List the agent's multi-chain signing keys (public addresses only). Private keys are never exposed.",
  similes: [
    "what wallets do I have",
    "list signing keys",
    "show my addresses",
    "what chains am I on",
    "my keys",
  ],
  examples: [
    [
      { name: "user", content: { text: "What signing keys do I have?" } },
      {
        name: "agent",
        content: { text: "Let me check your provisioned signing keys." },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime) => {
    return runtime.getService<OneClawService>("oneclaw") !== null;
  },

  handler: async (runtime: IAgentRuntime, message: any) => {
    const service = runtime.getService<OneClawService>("oneclaw");
    if (!service) {
      return { success: false, text: "1Claw service is not available." };
    }

    try {
      const keys = await service.listSigningKeys();
      if (keys.length === 0) {
        return {
          success: true,
          text: "No signing keys provisioned. A human can create them at 1claw.xyz/dashboard.",
        };
      }

      const active = keys.filter((k) => k.is_active);
      const lines = active.map(
        (k) => `• ${k.chain}: ${k.address}`,
      );
      return {
        success: true,
        text: `${active.length} active signing key(s):\n${lines.join("\n")}`,
        data: { signing_keys: active },
      };
    } catch (err: any) {
      return { success: false, text: `Failed to list signing keys: ${err.message}` };
    }
  },
};
