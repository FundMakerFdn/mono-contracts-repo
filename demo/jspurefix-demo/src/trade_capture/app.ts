import "reflect-metadata";
import { TradeCaptureServer } from "./trade-capture-server";
import { TradeCaptureClient } from "./trade-capture-client";
import { EngineFactory, IJsFixConfig } from "jspurefix";
import { IExtendedFixConfig } from "./types";
import { SessionLauncher } from "./session-launcher";

import "@nomicfoundation/hardhat-viem";
import hre from "hardhat";

class AppLauncher extends SessionLauncher {
  public constructor(
    client: string = "../../data/session/test-initiator.json",
    server: string = "../../data/session/test-acceptor.json"
  ) {
    super(client, server);
    this.root = __dirname;
  }

  protected override makeFactory(config: IJsFixConfig): EngineFactory {
    const extConfig = config as IExtendedFixConfig;
    const isInitiator = this.isInitiator(config.description);

    return {
      makeSession: () => {
        // Handle wallet setup internally if needed
        if (extConfig.description.walletId !== undefined) {
          // Initialize wallet asynchronously
          hre.viem
            .getWalletClients()
            .then((clients) => {
              const walletClient = clients[extConfig.description.walletId!];
              const address = walletClient.account.address;
              console.log(
                `Configured wallet address for ${
                  isInitiator ? "initiator" : "acceptor"
                }: ${address}`
              );
            })
            .catch((err) => {
              console.error("Failed to initialize wallet:", err);
            });
        } else {
          console.error("Undefined walletId");
        }

        return isInitiator
          ? new TradeCaptureClient(extConfig)
          : new TradeCaptureServer(extConfig);
      },
    } as EngineFactory;
  }
}

const l = new AppLauncher();
l.exec();
