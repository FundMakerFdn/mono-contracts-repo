const MockStorage = require("#root/mock/storage/mockStorage.js");
const { parseEther } = require("viem");
const config = require("#root/validator/config.js");
const PSymmParty = require("#root/pSymm/pSymmParty.js");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class PSymmPartyA extends PSymmParty {
  async handleTreePropose(socket, message) {
    if (message.payload.params.type === "transfer/withdraw/ERC20") {
      const amount = parseFloat(message.payload.params.collateralAmount);
      if (amount > 5) {
        // Add the half-signed message to the tree before opening settlement
        await this.treeBuilder.addMessage(
          message.payload.params,
          message.payload.signature
        );

        console.log(
          "Counterparty tries to withdraw too much, opening settlement..."
        );

        // Calculate custody ID bytes32
        const custodyId = await this.pSymm.read.getRollupBytes32({
          args: [
            message.payload.params.partyA,
            message.payload.params.partyB,
            BigInt(message.payload.params.custodyId),
          ],
        });

        // Get current tree state and store it in mock storage
        const treeState = this.treeBuilder.getTree();
        const storage = new MockStorage();
        const dataHash = storage.store(treeState);
        storage.close();

        console.log("Current datahash:", dataHash);

        // Create merkle root
        const merkleRoot = this.treeBuilder.getMerkleRoot();

        // Open settlement with actual merkle root and data hash
        const hash = await this.pSymm.write.openSettlement([
          custodyId,
          merkleRoot,
          `0x${dataHash}`, // Convert hash to bytes32 format
          true, // isA = true since this is Party A
        ]);

        await this.publicClient.waitForTransactionReceipt({ hash });
        console.log("Settlement opened");
        // socket.disconnect();
        // this.stop();

        throw new Error(
          "Counterparty tries to withdraw too much, settlement opened"
        );
      }
    }

    // Call parent class implementation for other cases
    return super.handleTreePropose(socket, message);
  }
}

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
  const walletClient = (await hre.viem.getWalletClients())[0];

  const partyA = new PSymmPartyA({
    address: walletClient.account.address,
    port: 3001,
    walletClient,
    publicClient: await hre.viem.getPublicClient(),
    pSymm,
    pSymmSettlement,
    mockSymm,
  });

  await partyA.start();
  await partyA.connectToCounterparty("http://127.0.0.1:3002");

  // Get PartyB's address
  const partyBAddress = (await hre.viem.getWalletClients())[1].account.address;

  // Execute flow
  await partyA.depositPersonal("10");

  // Generate bilateral custody ID
  const bilateralCustodyId = Math.floor(Math.random() * 2 ** 20) + 1;

  await partyA.initiateCustodyFlow(partyBAddress, bilateralCustodyId);

  // Add RFQ flow here
  const rfqParams = {
    type: "rfq/open/perps",
    partyA: walletClient.account.address,
    partyB: partyBAddress,
    custodyId: bilateralCustodyId.toString(),
    partyId: "1",
    ISIN: "BTC-USD-PERP",
    amount: "1",
    price: "50000",
    side: "1", // buy
    fundingRate: "0",
    IM_A: "1000",
    IM_B: "1000",
    MM_A: "800",
    MM_B: "800",
    CVA_A: "100",
    CVA_B: "100",
    MC_A: "900",
    MC_B: "900",
    contractExpiry: (Math.floor(Date.now() / 1000) + 86400).toString(), // 24h
    pricePrecision: "2",
    fundingRatePrecision: "6",
    cancelGracePeriod: "300",
    minContractAmount: "1",
    oracleType: "1",
    expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
    nonce: partyA.generateNonce().toString(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };

  // register a handler beforehand so that we can handle immediate response
  const rfqFillWait = new Promise((resolve) => {
    partyA.client.once("tree.propose", async (message) => {
      console.log(JSON.stringify(message));
      if (message.payload.params.type === "rfqFill/open/perps") {
        console.log("Received RFQ Fill");
        await partyA.handleTreePropose(partyA.client, message);
        console.log("-------------");
        resolve();
        console.log("Shouldve resolved");
      }
    });
  });
  console.log("Sending RFQ...");
  await partyA.proposeAndSignMessage(partyA.client, rfqParams);
  console.log("RFQ sent and signed");
  console.log("Waiting for RFQ Fill...");
  await rfqFillWait;

  // Add quote flow
  const quoteParams = {
    type: "quote/open/perps",
    partyA: walletClient.account.address,
    partyB: partyBAddress,
    custodyId: bilateralCustodyId.toString(),
    partyId: "1",
    ISIN: "BTC-USD-PERP",
    amount: "100", // 100 contract quote
    price: "50000",
    side: "1", // buy
    fundingRate: "0",
    IM_A: "1000",
    IM_B: "1000",
    MM_A: "800",
    MM_B: "800",
    CVA_A: "100",
    CVA_B: "100",
    MC_A: "900",
    MC_B: "900",
    contractExpiry: (Math.floor(Date.now() / 1000) + 86400).toString(), // 24h
    pricePrecision: "2",
    fundingRatePrecision: "6",
    cancelGracePeriod: "300",
    minContractAmount: "1",
    oracleType: "1",
    expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
    nonce: partyA.generateNonce().toString(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };

  // Wait for both quote fill responses
  const quoteFillWait = new Promise((resolve) => {
    let fillsReceived = 0;

    const handleQuoteFill = async (message) => {
      if (message.payload.params.type === "quoteFill/open/perps") {
        console.log(`Received Quote Fill ${fillsReceived + 1}`);
        await partyA.handleTreePropose(partyA.client, message);
        fillsReceived++;

        if (fillsReceived === 2) {
          partyA.client.removeListener("tree.propose", handleQuoteFill);
          resolve();
        }
      }
    };

    partyA.client.on("tree.propose", handleQuoteFill);
  });

  // Continue with existing custody transfer flow
  await partyA.transferCustody(
    partyA.client,
    true,
    "5",
    partyBAddress,
    bilateralCustodyId,
    true
  );

  console.log("Sending Quote...");
  await partyA.proposeAndSignMessage(partyA.client, quoteParams);
  console.log("Quote sent and signed");

  console.log("Waiting for Quote Fills...");
  await quoteFillWait;

  await partyA.transferCustody(
    partyA.client,
    false,
    "5",
    partyBAddress,
    bilateralCustodyId,
    true
  );

  await sleep(6000); // wait for party B to execute onchain
  console.log("Withdrawing deposit...");
  try {
    await partyA.withdrawPersonal("10");
  } catch (e) {
    console.error(
      "Failed to withdraw personal custody (may be due to bilateral custody lock)"
    );
  }

  // Print final tree state and root
  console.log("\nFinal Custody Rollup Tree State:");
  console.log(JSON.stringify(partyA.treeBuilder.getTree(), null, 2));
  console.log("\nMerkle Root:");
  console.log(partyA.treeBuilder.getMerkleRoot());

  partyA.stop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
