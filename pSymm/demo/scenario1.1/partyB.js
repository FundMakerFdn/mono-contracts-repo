const MockStorage = require("#root/mock/storage/mockStorage.js");
const config = require("#root/validator/config.js");
const PSymmParty = require("#root/pSymm/pSymmParty.js");

const { parseEther } = require("viem");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const deploymentData = await MockStorage.getDeploymentData(
    config.contractsTempFile
  );

  const pSymm = await hre.viem.getContractAt(
    "pSymm",
    deploymentData.data.contracts.pSymm
  );
  const pSymmSettlement = await hre.viem.getContractAt(
    "pSymmSettlement",
    deploymentData.data.contracts.pSymmSettlement
  );
  const mockSymm = await hre.viem.getContractAt(
    "MockSymm",
    deploymentData.data.contracts.MockSymm
  );
  const settleMaker = await hre.viem.getContractAt(
    "SettleMaker",
    deploymentData.data.contracts.SettleMaker
  );
  const walletClient = (await hre.viem.getWalletClients())[1]; // Use second wallet

  const partyB = new PSymmParty({
    address: walletClient.account.address,
    port: 3002,
    walletClient,
    publicClient: await hre.viem.getPublicClient(),
    pSymm,
    pSymmSettlement,
    mockSymm,
    settleMaker,
  });

  await partyB.depositPersonal("10");

  partyB.server.on("connection", async (socket) => {
    socket.on("tree.propose", async (message) => {
      const params = message.payload.params;

      if (params.type === "transfer/deposit/ERC20") {
        const isAdd = true; // For deposit
        await partyB.transferCustody(
          socket,
          isAdd,
          params.collateralAmount,
          params.partyA,
          params.custodyId,
          false // we are party B
        );
      } else if (params.type === "transfer/withdraw/ERC20") {
        const isAdd = false; // For withdrawal
        const adjustedAmount = (
          parseInt(params.collateralAmount) * 2
        ).toString();
        partyB.transferCustody(
          socket,
          isAdd,
          adjustedAmount,
          params.partyA,
          params.custodyId,
          false // we are party B
        );
        socket.on("tree.reject", async (msg) => {
          console.log("Received tree reject, opening settlement...");

          // Calculate custody ID bytes32
          const custodyId = await partyB.pSymm.read.getRollupBytes32({
            args: [params.partyA, params.partyB, BigInt(params.custodyId)],
          });

          // Get current tree state and store it in mock storage
          const treeState = partyB.treeBuilder.getTree();
          const storage = new MockStorage();
          const dataHash = storage.store(treeState);
          storage.close();

          console.log("Current datahash:", dataHash);

          // Create merkle root
          const merkleRoot = partyB.treeBuilder.getMerkleRoot();

          // Queue settlement instead of executing directly
          await partyB.queueSettlement(
            custodyId,
            merkleRoot,
            `0x${dataHash}`,
            false // isA = false since this is Party B
          );
          console.log("Settlement queued by Party B");
          socket.disconnect();
        });
      }

      if (message.payload.params.type === "rfq/open/perps") {
        console.log("Received RFQ, sending RFQ Fill...");

        await partyB.handleTreePropose(socket, message);

        const rfqFillParams = {
          type: "rfqFill/open/perps",
          partyA: message.payload.params.partyA,
          partyB: message.payload.params.partyB,
          custodyId: message.payload.params.custodyId,
          partyId: "2",
          ISIN: message.payload.params.ISIN,
          amount: message.payload.params.amount,
          price: message.payload.params.price,
          side: message.payload.params.side,
          fundingRate: message.payload.params.fundingRate,
          IM_A: message.payload.params.IM_A,
          IM_B: message.payload.params.IM_B,
          MM_A: message.payload.params.MM_A,
          MM_B: message.payload.params.MM_B,
          CVA_A: message.payload.params.CVA_A,
          CVA_B: message.payload.params.CVA_B,
          MC_A: message.payload.params.MC_A,
          MC_B: message.payload.params.MC_B,
          contractExpiry: message.payload.params.contractExpiry,
          pricePrecision: message.payload.params.pricePrecision,
          fundingRatePrecision: message.payload.params.fundingRatePrecision,
          cancelGracePeriod: message.payload.params.cancelGracePeriod,
          minContractAmount: message.payload.params.minContractAmount,
          oracleType: message.payload.params.oracleType,
          expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
          nonce: partyB.generateNonce(),
          timestamp: Math.floor(Date.now() / 1000).toString(),
        };

        await partyB.proposeAndSignMessage(socket, rfqFillParams);
        console.log("RFQ Fill sent");
      }

      if (message.payload.params.type === "quote/open/perps") {
        console.log("Received Quote, executing onchain queue");
        await partyB.executeOnchain();
        // Wait for Party A's balance to reach 5
        await partyB.waitForBalance(
          message.payload.params.partyA,
          partyB.mockSymm.address,
          parseEther("5")
        );
        console.log("sending two Quote Fills...");

        await partyB.handleTreePropose(socket, message);

        // First quote fill for 50 contracts
        const quoteFillParams1 = {
          type: "quoteFill/open/perps",
          partyA: message.payload.params.partyA,
          partyB: message.payload.params.partyB,
          custodyId: message.payload.params.custodyId,
          partyId: "2",
          ISIN: message.payload.params.ISIN,
          amount: "50", // Half of the original amount
          price: message.payload.params.price,
          side: message.payload.params.side,
          fundingRate: message.payload.params.fundingRate,
          IM_A: message.payload.params.IM_A,
          IM_B: message.payload.params.IM_B,
          MM_A: message.payload.params.MM_A,
          MM_B: message.payload.params.MM_B,
          CVA_A: message.payload.params.CVA_A,
          CVA_B: message.payload.params.CVA_B,
          MC_A: message.payload.params.MC_A,
          MC_B: message.payload.params.MC_B,
          contractExpiry: message.payload.params.contractExpiry,
          pricePrecision: message.payload.params.pricePrecision,
          fundingRatePrecision: message.payload.params.fundingRatePrecision,
          cancelGracePeriod: message.payload.params.cancelGracePeriod,
          minContractAmount: message.payload.params.minContractAmount,
          oracleType: message.payload.params.oracleType,
          expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
          nonce: partyB.generateNonce(),
          timestamp: Math.floor(Date.now() / 1000).toString(),
        };

        await partyB.proposeAndSignMessage(socket, quoteFillParams1);
        console.log("First Quote Fill sent (50 contracts)");

        // Second quote fill for remaining 50 contracts
        const quoteFillParams2 = {
          ...quoteFillParams1,
          nonce: partyB.generateNonce(),
          timestamp: Math.floor(Date.now() / 1000).toString(),
        };

        await partyB.proposeAndSignMessage(socket, quoteFillParams2);
        console.log("Second Quote Fill sent (50 contracts)");
      }
    });
  });

  await partyB.start();
  console.log("Waiting for PartyA to connect...");

  // Handle graceful shutdown on Ctrl+C
  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT (Ctrl+C). Cleaning up...");

    console.log("Executing final onchain action queue");
    await partyB.executeOnchain();

    partyB.stop();
    console.log("Withdrawing deposit...");
    try {
      await partyB.withdrawPersonal("10");
    } catch (e) {
      console.error(
        "Failed to withdraw personal custody (may be due to bilateral custody lock)"
      );
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
