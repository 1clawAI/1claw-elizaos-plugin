import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const listSecretsAction: Action = {
  name: "LIST_SECRETS",
  description:
    "List available secret paths in the 1Claw vault. Returns paths only, never values.",
  similes: [
    "what secrets do I have",
    "list credentials",
    "show vault contents",
    "what's stored",
    "browse secrets",
  ],
  examples: [
    [
      { name: "user", content: { text: "What secrets are in my vault?" } },
      {
        name: "agent",
        content: { text: "Let me list the available secret paths." },
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

    const text = message?.content?.text ?? "";
    const prefixMatch = text.match(
      /(?:prefix|under|in)\s+[`"']?([a-zA-Z0-9._/-]+)[`"']?/i,
    );
    const prefix = prefixMatch?.[1] ?? undefined;

    try {
      const secrets = await service.listSecrets(prefix);
      if (secrets.length === 0) {
        return {
          success: true,
          text: prefix
            ? `No secrets found under prefix '${prefix}'.`
            : "The vault is empty — no secrets stored yet.",
        };
      }

      const lines = secrets.map(
        (s) => `• ${s.path} (${s.type ?? "generic"}, v${s.version ?? 1})`,
      );
      return {
        success: true,
        text: `Found ${secrets.length} secret(s):\n${lines.join("\n")}`,
        data: { secrets },
      };
    } catch (err: any) {
      return { success: false, text: `Failed to list secrets: ${err.message}` };
    }
  },
};
