const hre = require("hardhat");
const { getIndexRegistryAddress, registerIndex, setCuratorWeights } = require("./configureIndexRegistry");

async function main() {
  const chainId = (await hre.viem.getPublicClient()).chain.id;
  const [deployer] = await hre.viem.getWalletClients();
  console.log("Configuring IndexRegistry with account:", deployer.account.address);
  console.log("Target chain ID:", chainId);

  // Auto-detect address from deployments-base.json
  const indexRegistryAddress = await getIndexRegistryAddress(chainId);
  console.log("Detected IndexRegistry at:", indexRegistryAddress);

  // Get the contract instance
  const indexRegistry = await hre.viem.getContractAt("IndexRegistry", indexRegistryAddress);

  // Get current nonce and gas prices
  const publicClient = await hre.viem.getPublicClient();
  const nonce = await publicClient.getTransactionCount({
    address: deployer.account.address,
    blockTag: "pending",
  });
  console.log("Current nonce:", nonce);

  const gasPriceInfo = await publicClient.getFeeHistory({
    blockCount: 10,
    blockTag: "latest",
    rewardPercentiles: [20],
  });
  const baseFee = BigInt(gasPriceInfo.baseFeePerGas[0] || 0n);
  const priorityFee = 5n * 10n ** 9n; // 5 gwei priority fee (increase if needed)
  const maxFeePerGas = baseFee + priorityFee + (1n * 10n ** 9n); // Add 1 gwei buffer

  console.log("Base Fee:", baseFee.toString());
  console.log("Priority Fee:", priorityFee.toString());
  console.log("Max Fee Per Gas:", maxFeePerGas.toString());

  // Transaction options
  const txOptions = {
    account: deployer.account,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
    nonce: nonce, // Explicitly set nonce to replace pending tx
  };

  // Configure the contract
  await registerIndex(indexRegistry, deployer, txOptions);
  txOptions.nonce++; // Increment nonce for the next transaction
  await setCuratorWeights(indexRegistry, deployer, txOptions);

  console.log("Configuration completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });