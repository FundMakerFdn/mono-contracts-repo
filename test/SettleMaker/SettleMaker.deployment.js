const assert = require("node:assert/strict");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  hashTypedData,
  keccak256,
  toHex,
  encodeAbiParameters,
  decodeEventLog,
  parseAbi,
} = require("viem");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");

// Helper to create merkle tree from settlements
function createInitialMerkleTree(leaves) {
  return StandardMerkleTree.of(leaves, ["bytes32"]);
}

async function deployFixture() {
  const [deployer, validator1, validator2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy mock SYMM token first
  const mockSymm = await hre.viem.deployContract("MockSymm");

  // Deploy EditSettlement first without settleMaker
  const editSettlement = await hre.viem.deployContract("EditSettlement", [
    "Edit Settlement",
    "1.0",
  ]);

  const validatorSettlement = await hre.viem.deployContract(
    "ValidatorSettlement",
    ["Validator Settlement", "1.0"]
  );

  const batchMetadataSettlement = await hre.viem.deployContract(
    "BatchMetadataSettlement",
    ["Batch Metadata Settlement", "1.0"]
  );

  // Get current timestamp
  const currentTimestamp = BigInt(await time.latest());

  const createTx =
    await batchMetadataSettlement.write.createBatchMetadataSettlement(
      [
        0n, // settlement start
        currentTimestamp + BigInt(5 * 24 * 60 * 60), // voting start: now + 5 days
        currentTimestamp + BigInt(7 * 24 * 60 * 60), // voting end: now + 7 days
      ],
      {
        account: deployer.account,
      }
    );

  const batchMetadataId = await getSettlementIdFromReceipt(
    createTx,
    publicClient,
    batchMetadataSettlement
  );

  // Create edit settlements for validator and batch metadata
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

  // Add validator whitelist settlement for deployer
  console.log("Creating validator whitelist settlement...");
  const validatorWhitelistTx =
    await validatorSettlement.write.createValidatorSettlement(
      [
        deployer.account.address, // validator address
        parseEther("1000"), // required SYMM amount
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

  // Create merkle tree with all initial settlements
  const merkleTree = createInitialMerkleTree([
    [validatorEditId],
    [batchMetadataEditId],
    [batchMetadataId],
    [validatorWhitelistId],
  ]);

  // Deploy SettleMaker with EditSettlement address, mockSymm address, and merkle root
  const settleMaker = await hre.viem.deployContract("SettleMaker", [
    editSettlement.address,
    mockSymm.address,
    merkleTree.root,
  ]);

  // Set SettleMaker addresses first
  await editSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  await batchMetadataSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  // Deploy pSymmSettlement contract
  const pSymmSettlement = await hre.viem.deployContract("pSymmSettlement", [
    settleMaker.address,
    "pSymm Settlement",
    "1.0",
  ]);

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

  // 3. Execute the batch metadata settlement last
  const proof = merkleTree.getProof([batchMetadataId]);
  await batchMetadataSettlement.write.executeSettlement(
    [0n, batchMetadataId, proof],
    { account: deployer.account }
  );

  return {
    mockSymm,
    editSettlement,
    validatorSettlement,
    batchMetadataSettlement,
    pSymmSettlement,
    settleMaker,
    deployer,
    validator1,
    validator2,
    publicClient,
    merkleTree,
    initialBatchMetadataId: batchMetadataId,
  };
}

function shouldDeploySettleMaker() {
  it("should have correct initial batch metadata", async function () {
    const { settleMaker, batchMetadataSettlement, initialBatchMetadataId } =
      await loadFixture(deployFixture);

    const currentTimestamp = BigInt(await time.latest());

    // Get metadata from settlement
    const [settlementStart, votingStart, votingEnd] =
      await batchMetadataSettlement.read.getBatchMetadataParameters([
        initialBatchMetadataId,
      ]);
    // Get metadata from SettleMaker to verify it was applied
    const currentMetadata = await settleMaker.read.currentBatchMetadata();

    // Verify timestamps in both places match
    assert.equal(
      currentMetadata.settlementStart,
      settlementStart,
      "Settlement start mismatch"
    );
    assert.equal(
      currentMetadata.votingStart,
      votingStart,
      "Voting start mismatch"
    );
    assert.equal(currentMetadata.votingEnd, votingEnd, "Voting end mismatch");

    // Verify actual values
    assert.equal(settlementStart, 0n, "Invalid settlement start");
    assert.ok(
      votingStart > currentTimestamp + BigInt(4 * 24 * 60 * 60),
      "Voting start should be ~5 days in future"
    );
    assert.ok(
      votingEnd > votingStart + BigInt(24 * 60 * 60),
      "Voting end should be ~2 days after voting start"
    );
  });
  it("should deploy with correct initial state", async function () {
    const { settleMaker, editSettlement, mockSymm, publicClient } =
      await loadFixture(deployFixture);

    // Check initial state
    const currentBatch = await settleMaker.read.currentBatch();
    assert.equal(currentBatch, 1n, "Initial batch should be 1");

    const editSettlementAddr = await settleMaker.read.editSettlementAddress();
    assert.equal(
      getAddress(editSettlementAddr),
      getAddress(editSettlement.address),
      "Incorrect edit settlement address"
    );

    const symmToken = await settleMaker.read.symmToken();
    assert.equal(
      getAddress(symmToken),
      getAddress(mockSymm.address),
      "Incorrect SYMM token address"
    );

    // Check initial batch metadata is empty
    const metadata = await settleMaker.read.currentBatchMetadata();
    assert.equal(metadata.settlementStart, 0n);
  });

  it("should start in VOTING_END state", async function () {
    const { settleMaker } = await loadFixture(deployFixture);

    const currentState = await settleMaker.read.getCurrentState();
    assert.equal(currentState, 1, "Initial state should be VOTING_END");
  });

  it("should not allow non-edit-settlement to update edit settlement", async function () {
    const { settleMaker, validator1 } = await loadFixture(deployFixture);

    await assert.rejects(
      async () => {
        await settleMaker.write.setEditSettlement(
          [validator1.account.address],
          {
            account: validator1.account,
          }
        );
      },
      {
        message: /Only edit settlement/,
      }
    );
  });
}

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

module.exports = {
  shouldDeploySettleMaker,
  deployFixture,
  getSettlementIdFromReceipt,
};
