const { parseEther } = require("viem");
const MockStorage = require("../SettleMaker/storage/mockStorage");
const config = require("../config.js");
const CustodyRollupTreeBuilder = require("./lib/custodyRollupTreeBuilder");

const WALLET_ID = 3;
const CUSTODY_ID = process.env.CUSTODY_ID || Math.floor(Math.random() * (2**20)) + 1;
const COLLATERAL_AMOUNT = "10";

async function main() {
  // Get deployment data
  let deploymentData;
  try {
    deploymentData = await MockStorage.getDeploymentData(
      config.contractsTempFile
    );
  } catch (err) {
    console.error("Error getting deployment data:", err.message);
    console.error("Make sure the deployer is running");
    process.exit(1);
  }

  // Get contract instances
  const pSymm = await hre.viem.getContractAt(
    "pSymm",
    deploymentData.data.contracts.pSymm
  );
  const mockSymm = await hre.viem.getContractAt(
    "MockSymm",
    deploymentData.data.contracts.MockSymm
  );

  // Get wallet client and public client
  const publicClient = await hre.viem.getPublicClient();
  const walletClients = await hre.viem.getWalletClients();
  const walletClient = walletClients[WALLET_ID];

  if (!walletClient) {
    console.error("Invalid wallet ID");
    process.exit(1);
  }

  console.log("Using account:", walletClient.account.address);

  // // First mint some SYMM tokens to the wallet
  // const deployer = walletClients[0];
  // await mockSymm.write.mint(
  //   [walletClient.account.address, parseEther("1000")],
  //   { account: deployer.account }
  // );

  // Initialize CustodyRollupTreeBuilder
  const treeBuilder = new CustodyRollupTreeBuilder();

  // Configure domain with pSymm contract address
  treeBuilder.setDomain(
    "CustodyRollup",
    "1",
    await publicClient.getChainId(),
    pSymm.address
  );

  console.log("\nStep 1: Creating initial vanilla custody tree...");

  // Create initial vanilla custody message
  const initMessage = {
    type: "initialize/billateral/standard",
    partyA: walletClient.account.address,
    partyB: walletClient.account.address, // Same address for personal custody
    custodyId: CUSTODY_ID.toString(),
    settlementAddress: deploymentData.data.contracts.pSymmSettlement,
    MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
    isManaged: "false",
    expiration: (Math.floor(Date.now() / 1000) + 3600).toString(), // 1 hour expiry
    timestamp: Math.floor(Date.now() / 1000).toString(),
    nonce: "0xA000000000000000000000000000000000000000000000000000000000000000",
  };

  // Add message to tree
  const messageHash = await treeBuilder.addMessage(initMessage);

  // Sign message with wallet
  const signature = await walletClient.signMessage({
    message: messageHash,
  });

  // Add signature to message
  treeBuilder.addSignature(messageHash, signature);

  // Since it's a personal custody, add same signature again (as both parties are same)
  treeBuilder.addSignature(messageHash, signature);

  // Print the tree
  // console.log("\nCustody Rollup Tree:");
  // console.log(JSON.stringify(treeBuilder.getTree(), null, 2));

  console.log("\nStep 2: Adding deposit message to tree...");

  // Create deposit message
  const depositMessage = {
    type: "transfer/deposit/ERC20",
    partyA: walletClient.account.address,
    partyB: walletClient.account.address, // Same address for personal custody
    custodyId: CUSTODY_ID.toString(),
    collateralAmount: COLLATERAL_AMOUNT,
    collateralToken: mockSymm.address,
    expiration: (Math.floor(Date.now() / 1000) + 3600).toString(), // 1 hour expiry
    timestamp: Math.floor(Date.now() / 1000).toString(),
    nonce: "0xA100000000000000000000000000000000000000000000000000000000000000",
  };

  // Add deposit message to tree
  const depositMessageHash = await treeBuilder.addMessage(depositMessage);

  // Sign deposit message with wallet
  const depositSignature = await walletClient.signMessage({
    message: depositMessageHash,
  });

  // Add signature to message (twice since it's personal custody)
  treeBuilder.addSignature(depositMessageHash, depositSignature);
  treeBuilder.addSignature(depositMessageHash, depositSignature);

  // Print updated tree
  console.log("\nUpdated Custody Rollup Tree with deposit:");
  console.log(JSON.stringify(treeBuilder.getTree(), null, 2));

  // 3. Deposit funds onchain
  console.log("\nStep 3: Depositing funds onchain...");

  // First approve SYMM tokens
  await mockSymm.write.approve([pSymm.address, parseEther(COLLATERAL_AMOUNT)], {
    account: walletClient.account,
  });

  // Then deposit into pSymm
  await pSymm.write.deposit(
    [mockSymm.address, parseEther(COLLATERAL_AMOUNT), CUSTODY_ID],
    { account: walletClient.account }
  );

  console.log(`Deposited ${COLLATERAL_AMOUNT} SYMM tokens`);

  let balance;
  // Print balance
  balance = await mockSymm.read.balanceOf([walletClient.account.address]);
  console.log("\nSYMM balance:", balance.toString());

  // 3. Withdraw funds
  console.log("\nStep 4: Withdrawing funds...");
  await pSymm.write.withdraw(
    [mockSymm.address, parseEther(COLLATERAL_AMOUNT), CUSTODY_ID],
    { account: walletClient.account }
  );

  console.log(`Withdrawn ${COLLATERAL_AMOUNT} SYMM tokens`);

  // Print final balance
  balance = await mockSymm.read.balanceOf([walletClient.account.address]);
  console.log("\nFinal SYMM balance:", balance.toString());

  console.log("\nDemo completed successfully!");
}

// Execute the demo
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

module.exports = main;
