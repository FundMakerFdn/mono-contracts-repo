const MockStorage = require("./storage/mockStorage");
const config = require("#root/validator/config.js");
const fs = require("fs");

function convertArg(arg) {
  if (arg === "true") return true;
  if (arg === "false") return false;
  return arg;
}

async function writeTask([walletId, contractName, functionName, ...args], hre) {
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

  if (!deploymentData || !deploymentData.data) {
    console.error("Could not find deployment data for hash:", dataHash);
    storage.close();
    process.exit(1);
  }

  // Get wallet client
  const walletClients = await hre.viem.getWalletClients();
  const walletClient = walletClients[walletId];

  if (!walletClient) {
    console.error("Invalid wallet ID");
    storage.close();
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
    storage.close();
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
      storage.close();
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
    storage.close();
    return tx;
  } catch (error) {
    console.error("Error writing function:", error);
    console.error("Error details:", error.message);
    storage.close();
    process.exit(1);
  }
}

module.exports = writeTask;
