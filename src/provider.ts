import type { Provider, IAgentRuntime } from "@elizaos/core";
import { OneClawService } from "./service";

export const oneClawContextProvider: Provider = {
  name: "ONECLAW_VAULT",
  description: "1Claw vault status: available secret paths, signing keys, and spend info",
  dynamic: true,

  get: async (runtime: IAgentRuntime) => {
    const service = runtime.getService<OneClawService>("oneclaw");
    if (!service) {
      return {
        text: "1Claw service is not available.",
        data: { available: false },
      };
    }

    const parts: string[] = [];
    let secretPaths: string[] = [];
    let signingKeys: Array<{ chain: string; address: string }> = [];
    let spendInfo = "";

    try {
      const secrets = await service.listSecrets();
      secretPaths = secrets.map((s) => s.path);
      const displayPaths =
        secretPaths.length > 30
          ? [...secretPaths.slice(0, 30), `... and ${secretPaths.length - 30} more`]
          : secretPaths;
      parts.push(
        `Available secret paths: ${displayPaths.join(", ") || "(none)"}`,
      );
    } catch {
      parts.push("Secret listing unavailable (check policies).");
    }

    try {
      const keys = await service.listSigningKeys();
      signingKeys = keys
        .filter((k) => k.is_active)
        .map((k) => ({ chain: k.chain, address: k.address }));
      if (signingKeys.length > 0) {
        const keyLines = signingKeys.map(
          (k) => `${k.chain} (${k.address.slice(0, 6)}...${k.address.slice(-4)})`,
        );
        parts.push(`Signing keys: ${keyLines.join(", ")}`);
      }
    } catch {
      // signing keys not provisioned or not accessible
    }

    try {
      const profile = await service.getAgentProfile();
      if (profile.tx_daily_limit_eth) {
        spendInfo = `Daily spend: ${profile.tx_spent_today_eth ?? "0"} / ${profile.tx_daily_limit_eth} ETH`;
        parts.push(spendInfo);
      }
    } catch {
      // agent profile not accessible
    }

    parts.push(
      "Use GET_SECRET to fetch credentials at runtime. Never paste secret values into chat.",
    );

    return {
      text: `You have a 1Claw vault attached.\n${parts.join("\n")}`,
      data: {
        available: true,
        secretPaths,
        signingKeys,
        spendInfo,
      },
    };
  },
};
