const hre = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const {
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { keccak256, toHex, decodeEventLog, parseEther } = require("viem");
const MockArweave = require("./storage/mockArweave");

async function getSettlementIdFromReceipt(txHash, publicClient, settlement) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  const SETTLEMENT_CREATED_EVENT = keccak256(
    toHex("SettlementCreated(bytes32,address,address)")
  );
  const settlementCreatedEvent = receipt.logs.find(
    (log) => log.topics[0] === SETTLEMENT_CREATED_EVENT
  );

  const decodedLog = decodeEventLog({
    abi: settlement.abi,
    eventName: "SettlementCreated",
    topics: settlementCreatedEvent.topics,
    data: settlementCreatedEvent.data,
  });

  return decodedLog.args.settlementId;
}

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  console.log("Deploying contracts with account:", deployer.account.address);

  // Deploy mock SYMM token first
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
    ["Validator Settlement", "1.0", mockSymm.address]
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
  const settlementStart = currentTimestamp;
  const votingStart = settlementStart + BigInt(3 * 24 * 60 * 60); // 3 days
  const votingEnd = votingStart + BigInt(2 * 24 * 60 * 60); // 2 days

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
    [validatorSettlement.address, 0n], // 0n = VALIDATOR type
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
    [batchMetadataSettlement.address, 1n], // 1n = BATCH_METADATA type
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

  // Store deployment data in mock Arweave
  const arweave = new MockArweave();
  const deploymentData = {
    timestamp: Date.now(),
    contracts: {
      mockSymm: mockSymm.address,
      editSettlement: editSettlement.address,
      validatorSettlement: validatorSettlement.address,
      batchMetadataSettlement: batchMetadataSettlement.address,
      settleMaker: settleMaker.address,
    },
    settlements: {
      batchMetadataId,
      validatorEditId,
      batchMetadataEditId,
    },
    merkleRoot: merkleTree.root,
    chainId: await publicClient.getChainId(),
  };

  const arweaveHash = arweave.store(deploymentData);
  arweave.close();

  console.log("\nDeployment successful!");
  console.log("\nDeployed contract addresses:");
  console.log("- MockSymm:", mockSymm.address);
  console.log("- EditSettlement:", editSettlement.address);
  console.log("- ValidatorSettlement:", validatorSettlement.address);
  console.log("- BatchMetadataSettlement:", batchMetadataSettlement.address);
  console.log("- SettleMaker:", settleMaker.address);
  console.log("\nInitial batch metadata ID:", batchMetadataId);
  console.log("\nDeployment data stored in Arweave with hash:", arweaveHash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
