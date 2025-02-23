const hre = require("hardhat");
const { parseEther } = require("viem");

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  console.log("Deploying contracts with account:", deployer.account.address);

  console.log("Deploying MockToken...");
  const mockToken = await hre.viem.deployContract("MockToken");
  console.log("MockToken deployed to:", mockToken.address);

  console.log("Deploying MockDeposit...");
  const mockDeposit = await hre.viem.deployContract("MockDeposit", [
    mockToken.address,
  ]);
  console.log("MockDeposit deployed to:", mockDeposit.address);

  console.log("Minting initial tokens to deployer...");
  await mockToken.write.mint([deployer.account.address, parseEther("10000")], {
    account: deployer.account,
  });

  console.log("Approving MockDeposit to spend tokens...");
  await mockToken.write.approve([mockDeposit.address, parseEther("10000")], {
    account: deployer.account,
  });

  const fs = require("fs");
  const deploymentData = {
    timestamp: Date.now(),
    contracts: {
      MockToken: mockToken.address,
      MockDeposit: mockDeposit.address,
    },
    chainId: await publicClient.getChainId(),
  };

  fs.mkdirSync("./frontend/src", { recursive: true });

  fs.writeFileSync(
    "./frontend/src/contracts.json",
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("\nDeployment successful!");
  console.log("\nDeployed contract addresses:");
  console.log("- MockToken:", mockToken.address);
  console.log("- MockDeposit:", mockDeposit.address);
  console.log("\nContract addresses saved to frontend/src/contracts.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});