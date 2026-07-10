import type { Plugin } from "@elizaos/core";
import { OneClawService } from "./service";
import { oneClawContextProvider } from "./provider";
import {
  getSecretAction,
  listSecretsAction,
  putSecretAction,
  signMessageAction,
  signTypedDataAction,
  simulateTransactionAction,
  submitTransactionAction,
  listSigningKeysAction,
  executeHttpAction,
  listBindingsAction,
} from "./actions";

export const oneClawPlugin: Plugin = {
  name: "1claw",
  description:
    "HSM-backed secrets, multi-chain signing, and execution intents for elizaOS agents via 1Claw.",
  services: [OneClawService as any],
  providers: [oneClawContextProvider],
  actions: [
    getSecretAction,
    listSecretsAction,
    putSecretAction,
    signMessageAction,
    signTypedDataAction,
    simulateTransactionAction,
    submitTransactionAction,
    listSigningKeysAction,
    executeHttpAction,
    listBindingsAction,
  ],
};

export default oneClawPlugin;
export { OneClawService } from "./service";
export { oneClawContextProvider } from "./provider";
export * from "./actions";
export * from "./types";
