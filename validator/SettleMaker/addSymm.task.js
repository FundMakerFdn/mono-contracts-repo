const { parseEther } = require("viem");
const MockStorage = require("./storage/mockStorage");
const config = require("#root/validator/config.js");
const fs = require("fs");

async function addSymmTask([walletId, amount = "1000"], hre) {

  // Use the static helper method
  let deploymentData;
  try {
    deploymentData = await MockStorage.getDeploymentData(config.contractsTempFile);
  } catch (err) {
    console.error(err.message);
    console.error("Make sure the deployer is running");
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
    deploymentData.data.contracts.MockSymm
  );

  // Mint SYMM tokens to specified wallet
  console.log(`Minting ${amount} SYMM to ${walletClient.account.address}...`);
  await mockSymm.write.mint(
    [walletClient.account.address, parseEther(amount)],
    { account: deployer.account }
  );

  const balance = await mockSymm.read.balanceOf([walletClient.account.address]);
  console.log(`New balance: ${balance} wei`);

  console.log("SYMM tokens minted successfully!");
}

module.exports = addSymmTask;
