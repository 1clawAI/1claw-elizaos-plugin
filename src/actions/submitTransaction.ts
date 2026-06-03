import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const submitTransactionAction: Action = {
  name: "SUBMIT_TRANSACTION",
  description:
    "Sign and broadcast an EVM transaction via the 1Claw Intents API. Runs simulation first unless explicitly bypassed. Per-agent guardrails (address allowlist, value cap, daily limit, chain restriction) are enforced server-side.",
  similes: [
    "send transaction",
    "submit transaction",
    "broadcast",
    "execute transaction",
    "transfer",
  ],
  examples: [
    [
      {
        name: "user",
        content: { text: "Send 0.01 ETH to 0x1234...abcd on Base" },
      },
      {
        name: "agent",
        content: {
          text: "I'll simulate first, then submit the transaction if it passes.",
        },
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

    const tx = message?.content?.transaction ?? message?.content?.tx;
    if (!tx || !tx.chain || !tx.to) {
      return {
        success: false,
        text: "Transaction object with at least 'chain' and 'to' is required.",
      };
    }

    const skipSimulation = message?.content?.skip_simulation === true;

    if (!skipSimulation) {
      try {
        const sim = await service.simulateTransaction(tx);
        if (sim.status !== "success") {
          return {
            success: false,
            text: `Transaction simulation reverted: ${sim.revert_reason ?? sim.error ?? "unknown"}. Aborting. Set skip_simulation=true to force.`,
            data: { simulation: sim },
          };
        }
      } catch (err: any) {
        return {
          success: false,
          text: `Simulation error: ${err.message}. Aborting.`,
        };
      }
    }

    try {
      const result = await service.submitTransaction(
        tx,
        message?.content?.idempotency_key,
      );
      return {
        success: true,
        text: `Transaction ${result.status}. Hash: ${result.tx_hash ?? "pending"}. From: ${result.from ?? "unknown"}.`,
        data: result,
      };
    } catch (err: any) {
      if (err.name === "OneClawGuardrailError") {
        return {
          success: false,
          text: `Transaction blocked by guardrail: ${err.message}`,
        };
      }
      return { success: false, text: `Transaction failed: ${err.message}` };
    }
  },
};
