import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const simulateTransactionAction: Action = {
  name: "SIMULATE_TRANSACTION",
  description:
    "Simulate an EVM transaction via Tenderly before sending. Returns gas estimate and revert info.",
  similes: [
    "simulate transaction",
    "dry run",
    "preview transaction",
    "test transaction",
    "check if this tx will work",
  ],
  examples: [
    [
      {
        name: "user",
        content: { text: "Simulate sending 0.1 ETH to 0xabc..." },
      },
      {
        name: "agent",
        content: { text: "Running a Tenderly simulation for that transaction." },
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

    try {
      const result = await service.simulateTransaction(tx);
      if (result.status === "success") {
        return {
          success: true,
          text: `Simulation passed. Gas used: ${result.gas_used ?? "unknown"}.${result.tenderly_dashboard_url ? ` Dashboard: ${result.tenderly_dashboard_url}` : ""}`,
          data: result,
        };
      } else {
        return {
          success: true,
          text: `Simulation reverted: ${result.revert_reason ?? result.error ?? "unknown reason"}.`,
          data: result,
        };
      }
    } catch (err: any) {
      return { success: false, text: `Simulation failed: ${err.message}` };
    }
  },
};
