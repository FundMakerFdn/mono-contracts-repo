const hre = require("hardhat");
const config = require("#root/apps/validator/config.js");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const {
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { keccak256, toHex, decodeEventLog, parseEther } = require("viem");
const MockStorage = require("#root/libs/mock/storage/mockStorage.js");

async function getSettlementIdFromReceipt(txHash, publicClient, settlement) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  // Find the SettlementCreated event log
  const log = receipt.logs.find((log) => {
    try {
      const event = decodeEventLog({
        abi: settlement.abi,
        data: log.data,
        topics: log.topics,
      });
      return event.eventName === "SettlementCreated";
    } catch {
      return false;
    }
  });

  if (!log) {
    throw new Error("Settlement creation event not found");
  }

  const event = decodeEventLog({
    abi: settlement.abi,
    data: log.data,
    topics: log.topics,
  });

  return event.args.settlementId;
}

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  console.log("Deploying contracts with account:", deployer.account.address);

  // Deploy pSymm contracts first
  console.log("Deploying pSymm contracts...");
  const pSymm = await hre.viem.deployContract("pSymm");
  console.log("pSymm deployed to:", pSymm.address);

  // Deploy mock SYMM token next
  const mockSymm = await hre.viem.deployContract("MockSymm");
  console.log("MockSymm deployed to:", mockSymm.address);

  // Deploy EditSettlement first without settleMaker
  const editSettlement = await hre.viem.deployContract("EditSettlement", [
    "Edit Settlement",
    "1.0",
  ]);
  console.log("EditSettlement deployed to:", editSettlement.address);

  const validatorSettlement = await hre.viem.deployContract(
    "ValidatorSettlement",
    ["Validator Settlement", "1.0"]
  );
  console.log("ValidatorSettlement deployed to:", validatorSettlement.address);

  const batchMetadataSettlement = await hre.viem.deployContract(
    "BatchMetadataSettlement",
    ["Batch Metadata Settlement", "1.0"]
  );
  console.log(
    "BatchMetadataSettlement deployed to:",
    batchMetadataSettlement.address
  );

  // Get current timestamp and calculate batch timing
  const currentTimestamp = BigInt(await time.latest());
  const settlementStart =
    currentTimestamp + BigInt(config.settleMaker.settlementDelay);
  const votingStart =
    settlementStart + BigInt(config.settleMaker.settlementDuration);
  const votingEnd = votingStart + BigInt(config.settleMaker.votingDuration);

  console.log("Creating initial batch metadata settlement...");
  const createTx =
    await batchMetadataSettlement.write.createBatchMetadataSettlement(
      [settlementStart, votingStart, votingEnd],
      {
        account: deployer.account,
      }
    );

  const batchMetadataId = await getSettlementIdFromReceipt(
    createTx,
    publicClient,
    batchMetadataSettlement
  );

  // Add validator whitelist settlement for deployer
  console.log("Creating validator whitelist settlement...");
  const validatorWhitelistTx =
    await validatorSettlement.write.createValidatorSettlement(
      [
        deployer.account.address, // validator address
        parseEther("1000"), // required SYMM amount (adjust as needed)
        true, // isAdd = true to add validator
      ],
      {
        account: deployer.account,
      }
    );

  const validatorWhitelistId = await getSettlementIdFromReceipt(
    validatorWhitelistTx,
    publicClient,
    validatorSettlement
  );

  // Mint SYMM tokens to deployer for staking
  await mockSymm.write.mint([deployer.account.address, parseEther("1000")], {
    account: deployer.account,
  });

  // Approve SYMM tokens for validator settlement
  await mockSymm.write.approve(
    [validatorSettlement.address, parseEther("1000")],
    {
      account: deployer.account,
    }
  );

  // Create edit settlements for validator and batch metadata
  console.log("Creating edit settlements...");
  const validatorEditTx = await editSettlement.write.createEditSettlement(
    [validatorSettlement.address, 1n], // 1n = VALIDATOR type
    {
      account: deployer.account,
    }
  );
  const validatorEditId = await getSettlementIdFromReceipt(
    validatorEditTx,
    publicClient,
    editSettlement
  );

  const batchMetadataEditTx = await editSettlement.write.createEditSettlement(
    [batchMetadataSettlement.address, 2n], // 2n = BATCH_METADATA type
    {
      account: deployer.account,
    }
  );
  const batchMetadataEditId = await getSettlementIdFromReceipt(
    batchMetadataEditTx,
    publicClient,
    editSettlement
  );

  // Create merkle tree with all initial settlements
  const merkleTree = StandardMerkleTree.of(
    [
      [validatorEditId],
      [batchMetadataEditId],
      [batchMetadataId],
      [validatorWhitelistId],
    ],
    ["bytes32"]
  );

  console.log("Deploying SettleMaker...");
  const settleMaker = await hre.viem.deployContract("SettleMaker", [
    editSettlement.address,
    mockSymm.address,
    merkleTree.root,
  ]);
  console.log("SettleMaker deployed to:", settleMaker.address);
  console.log("First soft fork root:", merkleTree.root);

  // Deploy pSymm Settlement contract
  const pSymmSettlement = await hre.viem.deployContract("pSymmSettlement", [
    settleMaker.address, // _settleMaker address
    "pSymm Settlement", // name
    "1.0", // version
  ]);
  console.log("pSymmSettlement deployed to:", pSymmSettlement.address);

  // Set SettleMaker addresses
  console.log("Setting SettleMaker addresses...");
  await editSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  await batchMetadataSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  await validatorSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  // Execute settlements
  console.log("Executing initial settlements...");

  // 1. Execute batch metadata edit settlement first
  const batchMetadataProof = merkleTree.getProof([batchMetadataEditId]);
  await editSettlement.write.executeSettlement(
    [0n, batchMetadataEditId, batchMetadataProof],
    { account: deployer.account }
  );

  // 2. Execute validator edit settlement second
  const validatorProof = merkleTree.getProof([validatorEditId]);
  await editSettlement.write.executeSettlement(
    [0n, validatorEditId, validatorProof],
    { account: deployer.account }
  );

  // 3. Execute the batch metadata settlement
  const proof = merkleTree.getProof([batchMetadataId]);
  await batchMetadataSettlement.write.executeSettlement(
    [0n, batchMetadataId, proof],
    { account: deployer.account }
  );

  // 4. Execute validator whitelist settlement last
  const validatorWhitelistProof = merkleTree.getProof([validatorWhitelistId]);
  await validatorSettlement.write.executeSettlement(
    [0n, validatorWhitelistId, validatorWhitelistProof],
    { account: deployer.account }
  );

  // Store deployment data in mock Storage
  const storage = new MockStorage();
  const deploymentData = {
    timestamp: Date.now(),
    contracts: {
      MockSymm: mockSymm.address,
      EditSettlement: editSettlement.address,
      ValidatorSettlement: validatorSettlement.address,
      BatchMetadataSettlement: batchMetadataSettlement.address,
      SettleMaker: settleMaker.address,
      pSymm: pSymm.address,
      pSymmSettlement: pSymmSettlement.address,
    },
    settlements: {
      batchMetadataId,
      validatorEditId,
      batchMetadataEditId,
    },
    merkleRoot: merkleTree.root,
    chainId: await publicClient.getChainId(),
  };

  // Verify deployer is properly registered as validator
  const isValidator = await settleMaker.read.verifyValidator([
    deployer.account.address,
  ]);
  if (!isValidator) {
    throw new Error("Deployer was not properly registered as validator");
  }

  console.log("Verified deployer is registered as validator");

  const storageHash = storage.store(deploymentData);
  storage.close();

  // Initialize and start validator
  const DeploymentValidator = require("./DeploymentValidator");
  const validator = new DeploymentValidator(
    publicClient,
    deployer,
    {
      settleMaker,
      batchMetadataSettlement,
      validatorSettlement,
      editSettlement,
      mockSymm,
      pSymmSettlement,
    },
    config,
    true
  );

  console.log("\nStarting validator...");
  await validator.start();

  // Note: The validator will continue running until manually stopped
  // You may want to add process handling to gracefully stop the validator
  process.on("SIGINT", () => {
    console.log("\nStopping validator...");
    validator.stop();
    process.exit();
  });

  // Write deployment data to temp file
  const fs = require("fs");
  const tempData = {
    dataHash: storageHash,
    timestamp: Date.now(),
  };
  fs.writeFileSync(config.contractsTempFile, JSON.stringify(tempData, null, 2));

  // Add cleanup on SIGINT
  process.on("SIGINT", () => {
    console.log("\nStopping validator...");
    validator.stop();
    // Remove temp file
    try {
      fs.unlinkSync(config.contractsTempFile);
      console.log("Removed temporary contracts file");
    } catch (err) {
      console.error("Error removing temp file:", err);
    }
    process.exit();
  });

  console.log("\nDeployment successful!");
  console.log("\nDeployed contract addresses:");
  console.log("- MockSymm:", mockSymm.address);
  console.log("- EditSettlement:", editSettlement.address);
  console.log("- ValidatorSettlement:", validatorSettlement.address);
  console.log("- BatchMetadataSettlement:", batchMetadataSettlement.address);
  console.log("- SettleMaker:", settleMaker.address);
  console.log("- pSymm:", pSymm.address);
  console.log("- pSymmSettlement:", pSymmSettlement.address);
  console.log("\nInitial batch metadata ID:", batchMetadataId);
  console.log("\nDeployment data in Storage with hash:", storageHash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
