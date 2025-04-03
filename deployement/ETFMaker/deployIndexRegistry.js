const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_LOG_FILE = path.resolve(__dirname, "../deployments-base.json");

async function deployIndexRegistry(saveDeployment, chainId) {
  const [deployer] = await hre.viem.getWalletClients();
  console.log("Checking IndexRegistry with account:", deployer.account.address);
  console.log("Target chain ID:", chainId);

  let deployments = [];
  if (fs.existsSync(DEPLOYMENT_LOG_FILE)) {
    const fileContent = fs.readFileSync(DEPLOYMENT_LOG_FILE, "utf8");
    deployments = JSON.parse(fileContent || "[]");
  }

  const existingDeployment = deployments.find(
    (d) => d.contractName === "IndexRegistry" && d.chainId === chainId
  );

  let indexRegistry;
  if (existingDeployment) {
    console.log("IndexRegistry already deployed at:", existingDeployment.address);
    indexRegistry = await hre.viem.getContractAt("IndexRegistry", existingDeployment.address);
  } else {
    console.log("Deploying IndexRegistry...");
    indexRegistry = await hre.viem.deployContract("IndexRegistry");
    console.log("IndexRegistry deployed to:", indexRegistry.address);
    await saveDeployment("IndexRegistry", chainId, indexRegistry.address);
  }

  return indexRegistry;
}

module.exports = { deployIndexRegistry };