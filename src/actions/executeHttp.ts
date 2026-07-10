import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const executeHttpAction: Action = {
  name: "EXECUTE_HTTP",
  description:
    "Execute an HTTP request through a pre-configured binding. The binding's credential is injected server-side — the agent never sees it. Requires execution_intents_enabled on the agent and a Pro+ plan.",
  similes: [
    "call API",
    "execute http",
    "run http request",
    "call external service",
    "execute binding",
    "make API call",
  ],
  examples: [
    [
      {
        name: "user",
        content: { text: "Call the GitHub API to list my repos" },
      },
      {
        name: "agent",
        content: {
          text: "I'll execute that through the github-api binding.",
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

    const req = message?.content?.execution ?? message?.content;
    const binding = req?.binding;
    if (!binding) {
      return {
        success: false,
        text: "A 'binding' name is required (e.g. 'github-api', 'stripe').",
      };
    }

    try {
      const result = await service.executeHttp({
        binding,
        method: req.method ?? "GET",
        path: req.path ?? "",
        headers: req.headers,
        body: req.body,
        execution_mode: req.execution_mode ?? "vault",
      });
      return {
        success: true,
        text: `HTTP ${result.status_code} from binding "${binding}".`,
        data: result,
      };
    } catch (err: any) {
      if (err.name === "OneClawPolicyDeniedError") {
        return {
          success: false,
          text: `Execution denied: ${err.message}. Ensure execution_intents_enabled is on and the agent has a Pro+ plan.`,
        };
      }
      return { success: false, text: `Execution failed: ${err.message}` };
    }
  },
};
