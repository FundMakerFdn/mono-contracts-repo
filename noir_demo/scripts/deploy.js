const hre = require("hardhat");
const { parseEther } = require("viem");

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  console.log("Deploying contracts with account:", deployer.account.address);

  // Deploy MockToken
  console.log("Deploying MockToken...");
  const mockToken = await hre.viem.deployContract("MockToken");
  console.log("MockToken deployed to:", mockToken.address);

  // Deploy MockDeposit
  console.log("Deploying MockDeposit...");
  const mockDeposit = await hre.viem.deployContract("MockDeposit", [
    mockToken.address,
  ]);
  console.log("MockDeposit deployed to:", mockDeposit.address);

  // Deploy noirPsymm
  console.log("Deploying noirPsymm...");
  const noirPsymm = await hre.viem.deployContract("noirPsymm");
  console.log("noirPsymm deployed to:", noirPsymm.address);

  // Initial token minting
  console.log("Minting initial tokens to deployer...");
  await mockToken.write.mint([deployer.account.address, parseEther("10000")], {
    account: deployer.account,
  });

  // Approve token spending
  console.log("Approving contracts to spend tokens...");
  // Approve MockDeposit
  await mockToken.write.approve([mockDeposit.address, parseEther("10000")], {
    account: deployer.account,
  });
  // Approve noirPsymm
  await mockToken.write.approve([noirPsymm.address, parseEther("10000")], {
    account: deployer.account,
  });

  const fs = require("fs");
  const deploymentData = {
    timestamp: Date.now(),
    contracts: {
      MockToken: mockToken.address,
      MockDeposit: mockDeposit.address,
      noirPsymm: noirPsymm.address
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
  console.log("- noirPsymm:", noirPsymm.address);
  console.log("\nContract addresses saved to frontend/src/contracts.json");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});