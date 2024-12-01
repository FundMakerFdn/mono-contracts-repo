const { parseEther } = require("viem");
const MockStorage = require("./storage/mockStorage");
const config = require("#root/validator/config.js");
const fs = require("fs");

async function addSymmTask([walletId, amount = "1000"], hre) {

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

  // Get wallet clients
  const walletClients = await hre.viem.getWalletClients();
  const walletClient = walletClients[walletId];
  const deployer = walletClients[0]; // Get deployer wallet (first account)

  if (!walletClient) {
    console.error("Invalid wallet ID");
    process.exit(1);
  }

  // Get MockSymm contract instance
  const mockSymm = await hre.viem.getContractAt(
    "MockSymm",
    deploymentData.data.contracts.mockSymm
  );

  // Mint SYMM tokens to specified wallet
  console.log(`Minting ${amount} SYMM to ${walletClient.account.address}...`);
  await mockSymm.write.mint(
    [walletClient.account.address, parseEther(amount)],
    { account: deployer.account }
  );

  const balance = await mockSymm.read.balanceOf([walletClient.account.address]);
  console.log(`New balance: ${balance} wei`);

  storage.close();
  console.log("SYMM tokens minted successfully!");
}

module.exports = addSymmTask;
