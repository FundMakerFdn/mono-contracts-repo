const hre = require("hardhat");
const MockStorage = require("./storage/mockStorage");

async function main() {
  if (process.argv.length < 4) {
    console.error("Usage: node validator.js <wallet-id> <contracts-data-hash>");
    process.exit(1);
  }

  const walletId = process.argv[2];
  const dataHash = process.argv[3];

  // Get deployment data from storage
  const storage = new MockStorage();
  const deploymentData = storage.get(dataHash);

  if (!deploymentData) {
    console.error("Could not find deployment data for hash:", dataHash);
    process.exit(1);
  }

  // Get wallet client and public client
  const publicClient = await hre.viem.getPublicClient();
  const walletClients = await hre.viem.getWalletClients();
  const walletClient = walletClients[walletId];

  if (!walletClient) {
    console.error("Invalid wallet ID");
    process.exit(1);
  }

  // Get contract instances
  const contracts = {
    settleMaker: await hre.viem.getContractAt(
      "SettleMaker",
      deploymentData.data.contracts.settleMaker
    ),
    validatorSettlement: await hre.viem.getContractAt(
      "ValidatorSettlement",
      deploymentData.data.contracts.validatorSettlement
    ),
    batchMetadata: await hre.viem.getContractAt(
      "BatchMetadataSettlement",
      deploymentData.data.contracts.batchMetadataSettlement
    ),
    editSettlement: await hre.viem.getContractAt(
      "EditSettlement",
      deploymentData.data.contracts.editSettlement
    ),
    mockSymm: await hre.viem.getContractAt(
      "MockSymm",
      deploymentData.data.contracts.mockSymm
    ),
  };

  // Load config
  const config = require("../config.js");

  // Initialize validator
  const Validator = require("./Validator.js");
  const validator = new Validator(
    publicClient,
    walletClient,
    contracts,
    config,
    false // Not a main validator
  );

  console.log("\nStarting validator...");
  await validator.start();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nStopping validator...");
    validator.stop();
    process.exit();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
