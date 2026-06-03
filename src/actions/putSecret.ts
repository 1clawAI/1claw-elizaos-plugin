import type { Action, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "../service";

const VALID_PATH = /^[a-zA-Z0-9._/-]+$/;

export const putSecretAction: Action = {
  name: "PUT_SECRET",
  description:
    "Store or update a secret in the 1Claw vault at a given path.",
  similes: [
    "store secret",
    "save credential",
    "put key",
    "write secret",
    "save this token",
    "store this API key",
  ],
  examples: [
    [
      {
        name: "user",
        content: { text: "Store my new OpenAI key as api-keys/openai" },
      },
      {
        name: "agent",
        content: { text: "I'll save that at api-keys/openai in the vault." },
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

    const path: string | undefined = message?.content?.path;
    const value: string | undefined = message?.content?.value;

    if (!path || !value) {
      return {
        success: false,
        text: "Both 'path' and 'value' are required to store a secret.",
      };
    }

    if (!VALID_PATH.test(path) || path.includes("..")) {
      return {
        success: false,
        text: `Invalid path '${path}'. Use alphanumeric characters, dots, dashes, underscores, and forward slashes.`,
      };
    }

    try {
      const result = await service.putSecret(path, value, {
        type: message?.content?.type,
      });
      return {
        success: true,
        text: `Secret stored at '${path}' (version ${result.version}).`,
      };
    } catch (err: any) {
      return { success: false, text: `Failed to store secret: ${err.message}` };
    }
  },
};
