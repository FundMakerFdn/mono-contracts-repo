const MockStorage = require("./storage/mockStorage");
const config = require("#root/validator/config.js");
const fs = require("fs");

function convertArg(arg) {
  if (arg === "true") return true;
  if (arg === "false") return false;
  return arg;
}

async function writeTask([walletId, contractName, functionName, ...args], hre) {
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

  // Get wallet client
  const walletClients = await hre.viem.getWalletClients();
  const walletClient = walletClients[walletId];

  if (!walletClient) {
    console.error("Invalid wallet ID");
    process.exit(1);
  }

  // Get contract instance
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
    if (!contract.write[functionName]) {
      console.error(
        `Write function ${functionName} not found in contract ${contractName}`
      );
      console.log("Available write functions:", Object.keys(contract.write));
      process.exit(1);
    }

    console.log(
      `Writing ${functionName} to ${contractName} at ${contractAddress}...`
    );
    // Convert string booleans to actual booleans
    const convertedArgs = args.map(convertArg);

    if (convertedArgs.length > 0) {
      console.log("Arguments:", convertedArgs);
    }

    // Execute write function with converted args
    const tx = await contract.write[functionName]([].concat(convertedArgs), {
      account: walletClient.account,
    });

    console.log("Transaction hash:", tx);
    return tx;
  } catch (error) {
    console.error("Error writing function:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
}

module.exports = writeTask;
