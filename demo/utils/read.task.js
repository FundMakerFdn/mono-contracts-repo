const MockStorage = require("#root/mock/storage/mockStorage.js");
const config = require("#root/validator/config.js");
const fs = require("fs");

async function readTask([contractName, functionName, ...args], hre) {
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

  // Get contract instance - note we access contracts through deploymentData.data
  const contractAddress = deploymentData.data.contracts[contractName];
  if (!contractAddress) {
    console.error(`Contract ${contractName} not found in deployment data`);
    console.log(
      "Available contracts:",
      Object.keys(deploymentData.data.contracts)
    );
    process.exit(1);
  }

  const contract = await hre.viem.getContractAt(contractName, contractAddress);

  try {
    // Check if function exists
    if (!contract.read[functionName]) {
      console.error(
        `Read function ${functionName} not found in contract ${contractName}`
      );
      console.log("Available read functions:", Object.keys(contract.read));
      process.exit(1);
    }

    console.log(
      `Reading ${functionName} from ${contractName} at ${contractAddress}...`
    );
    if (args.length > 0) {
      console.log("Arguments:", args);
    }

    // Convert string booleans to actual booleans
    const convertArg = (arg) => {
      if (arg === "true") return true;
      if (arg === "false") return false;
      return arg;
    };
    const convertedArgs = args.map(convertArg);

    // Execute read function with converted args
    const result = await contract.read[functionName]([].concat(convertedArgs));
    console.log("Result:", result);

    return result;
  } catch (error) {
    console.error("Error reading function:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
}

module.exports = readTask;
