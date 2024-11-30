const { parseEther } = require("viem");
const MockStorage = require("./storage/mockStorage");
const config = require("#root/validator/config.js");
const fs = require("fs");

async function validatorTask(taskArgs, hre) {
  const { walletId } = taskArgs;

  // Read deployment data from temp file
  let dataHash;
  try {
    const tempData = JSON.parse(fs.readFileSync(config.contractsTempFile));
    dataHash = tempData.dataHash;
    console.log("Read contracts data from temporary file");
  } catch (err) {
    console.error("Could not read temporary contracts file:", err);
    console.error("Make sure the deployer is running");
    process.exit(1);
  }

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
  const deployer = walletClients[0]; // Get deployer wallet (first account)

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
