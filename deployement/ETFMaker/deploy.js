const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { deployIndexRegistry } = require("./deployIndexRegistry");

const DEPLOYMENT_LOG_FILE = path.resolve(__dirname, "../deployments-base.json");

async function saveDeployment(contractName, chainId, address) {
  let deployments = [];
  if (fs.existsSync(DEPLOYMENT_LOG_FILE)) {
    const fileContent = fs.readFileSync(DEPLOYMENT_LOG_FILE, "utf8");
    deployments = JSON.parse(fileContent || "[]");
  }
  const deploymentEntry = {
    contractName,
    chainId,
    address,
    timestamp: new Date().toISOString(),
  };
  deployments.push(deploymentEntry);
  fs.writeFileSync(DEPLOYMENT_LOG_FILE, JSON.stringify(deployments, null, 2));
  console.log(`Saved deployment to ${DEPLOYMENT_LOG_FILE}: ${contractName} at ${address} on chain ${chainId}`);
}

async function main() {
  console.log("Starting deployment process...");
  const chainId = (await hre.viem.getPublicClient()).chain.id;
  const indexRegistry = await deployIndexRegistry(saveDeployment, chainId);
  console.log("Deployment process completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });