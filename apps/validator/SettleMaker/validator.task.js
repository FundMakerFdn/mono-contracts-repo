const { parseEther } = require("viem");
const MockStorage = require("#root/libs/mock/storage/mockStorage.js");
const config = require("#root/apps/validator/config.js");
const fs = require("fs");

async function validatorTask([walletId], hre) {
  // Use the static helper method
  let deploymentData;
  try {
    deploymentData = await MockStorage.getDeploymentData(
      config.contractsTempFile
    );
  } catch (err) {
    console.error(err.message);
    console.error("Make sure the deployer is running");
    process.exit(1);
  }

  // Get wallet client and public client
  const publicClient = await hre.viem.getPublicClient();
  const walletClients = await hre.viem.getWalletClients();
  const walletClient = walletClients[walletId];
  const deployer = walletClients[0]; // Get deployer wallet (first account)

  if (!walletClient) {
    console.error("Invalid wallet ID");
    process.exit(1);
  }

  // Get contract instances
  const contracts = {
    settleMaker: await hre.viem.getContractAt(
      "SettleMaker",
      deploymentData.data.contracts.SettleMaker
    ),
    validatorSettlement: await hre.viem.getContractAt(
      "ValidatorSettlement",
      deploymentData.data.contracts.ValidatorSettlement
    ),
    batchMetadataSettlement: await hre.viem.getContractAt(
      "BatchMetadataSettlement",
      deploymentData.data.contracts.BatchMetadataSettlement
    ),
    editSettlement: await hre.viem.getContractAt(
      "EditSettlement",
      deploymentData.data.contracts.EditSettlement
    ),
    mockSymm: await hre.viem.getContractAt(
      "MockSymm",
      deploymentData.data.contracts.MockSymm
    ),
  };

  // Approve SYMM tokens for validator settlement
  console.log("Approving SYMM tokens for validator settlement...");
  await contracts.mockSymm.write.approve(
    [contracts.validatorSettlement.address, parseEther("1000")],
    { account: walletClient.account }
  );

  // Initialize validator
  const Validator = require("./Validator.js");
  const validator = new Validator(
    publicClient,
    walletClient,
    contracts,
    config
  );

  await validator.start();

  // Create a promise that never resolves to keep the process running
  return new Promise((resolve) => {
    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\nStopping validator...");
      validator.stop();
      resolve(); // Now resolve the promise to allow the process to exit
    });
  });
}

module.exports = validatorTask;
