import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const signTypedDataAction: Action = {
  name: "SIGN_TYPED_DATA",
  description:
    "Sign EIP-712 typed data (permits, orders, structured messages) using the agent's 1Claw signing key.",
  similes: [
    "sign typed data",
    "sign permit",
    "sign order",
    "eip-712 sign",
    "sign this struct",
  ],
  examples: [
    [
      { name: "user", content: { text: "Sign this EIP-712 permit for the swap" } },
      {
        name: "agent",
        content: { text: "Submitting the typed data to 1Claw for signing." },
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

    const chain: string = message?.content?.chain ?? "ethereum";
    const typedData: Record<string, unknown> | undefined =
      message?.content?.typed_data ?? message?.content?.typedData;

    if (!typedData) {
      return {
        success: false,
        text: "EIP-712 typed_data object is required.",
      };
    }

    try {
      const result = await service.signTypedData({ chain, typed_data: typedData });
      return {
        success: true,
        text: `Typed data signed successfully.\nSignature: ${result.signature}\nFrom: ${result.from ?? "unknown"}`,
        data: result,
      };
    } catch (err: any) {
      if (err.name === "OneClawGuardrailError") {
        return {
          success: false,
          text: `Guardrail denied: ${err.message}. Check eip712_domain_allowlist on the agent.`,
        };
      }
      return { success: false, text: `Signing failed: ${err.message}` };
    }
  },
};
