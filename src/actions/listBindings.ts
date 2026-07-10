import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const listBindingsAction: Action = {
  name: "LIST_BINDINGS",
  description:
    "List all active bindings (pre-configured credential handles) for external services. Bindings are created by humans — agents can only use them, not create or modify them.",
  similes: [
    "list bindings",
    "show bindings",
    "what services can I call",
    "available integrations",
    "my bindings",
  ],
  examples: [
    [
      { name: "user", content: { text: "What bindings do I have?" } },
      {
        name: "agent",
        content: { text: "Let me check your configured service bindings." },
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
      const bindings = await service.listBindings();
      if (bindings.length === 0) {
        return {
          success: true,
          text: "No bindings configured. A human can create them at 1claw.xyz/dashboard on the agent detail page.",
        };
      }

      const lines = bindings.map(
        (b) => `• ${b.name} (${b.binding_type})${b.base_url ? ` — ${b.base_url}` : ""}`,
      );
      return {
        success: true,
        text: `${bindings.length} binding(s):\n${lines.join("\n")}`,
        data: { bindings },
      };
    } catch (err: any) {
      return { success: false, text: `Failed to list bindings: ${err.message}` };
    }
  },
};
