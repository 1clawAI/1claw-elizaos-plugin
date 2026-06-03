import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const signMessageAction: Action = {
  name: "SIGN_MESSAGE",
  description:
    "Sign an EIP-191 personal message using the agent's 1Claw signing key. The private key never leaves the HSM.",
  similes: [
    "sign this message",
    "personal sign",
    "sign for verification",
    "prove ownership",
  ],
  examples: [
    [
      { name: "user", content: { text: "Sign 'hello world' with my ethereum key" } },
      {
        name: "agent",
        content: { text: "Signing that message via 1Claw Intents API." },
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
    const msg: string | undefined = message?.content?.message;

    if (!msg) {
      return {
        success: false,
        text: "A message to sign is required.",
      };
    }

    try {
      const result = await service.signMessage({ chain, message: msg });
      return {
        success: true,
        text: `Message signed successfully.\nSignature: ${result.signature}\nFrom: ${result.from ?? "unknown"}`,
        data: result,
      };
    } catch (err: any) {
      return { success: false, text: `Signing failed: ${err.message}` };
    }
  },
};
