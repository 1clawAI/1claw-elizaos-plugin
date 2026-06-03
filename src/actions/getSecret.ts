import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

export const getSecretAction: Action = {
  name: "GET_SECRET",
  description:
    "Fetch a secret from the 1Claw vault by path. The value is returned to the agent's tool channel but NEVER shown in user-facing chat.",
  similes: [
    "fetch secret",
    "read secret",
    "get credential",
    "retrieve key",
    "look up secret",
    "pull the API key",
  ],
  examples: [
    [
      { name: "user", content: { text: "Get my Stripe key from the vault" } },
      {
        name: "agent",
        content: { text: "I'll fetch the secret at api-keys/stripe from your vault." },
      },
    ],
    [
      { name: "user", content: { text: "Read the database password" } },
      {
        name: "agent",
        content: { text: "Retrieving the secret at db/password." },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: any) => {
    const service = runtime.getService<OneClawService>("oneclaw");
    return service !== null && service !== undefined;
  },

  handler: async (runtime: IAgentRuntime, message: any) => {
    const service = runtime.getService<OneClawService>("oneclaw");
    if (!service) {
      return { success: false, text: "1Claw service is not available." };
    }

    const text = message?.content?.text ?? "";
    const pathMatch = text.match(
      /(?:at|path|from)\s+[`"']?([a-zA-Z0-9._/-]+)[`"']?/i,
    );
    const path = pathMatch?.[1] ?? message?.content?.path;

    if (!path) {
      return {
        success: false,
        text: "Please specify the secret path (e.g. api-keys/stripe).",
      };
    }

    try {
      const secret = await service.getSecret(path);
      return {
        success: true,
        text: `[REDACTED] Secret at '${path}' retrieved (type: ${secret.type ?? "generic"}, version: ${secret.version ?? 1}). The value has been loaded into my working context.`,
        data: { value: secret.value, path, type: secret.type },
      };
    } catch (err: any) {
      return { success: false, text: `Failed to fetch secret: ${err.message}` };
    }
  },
};
