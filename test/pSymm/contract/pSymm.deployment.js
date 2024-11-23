const assert = require("node:assert/strict");
const { shouldDeploySettleMaker } = require('../SettleMaker/SettleMaker.deployment');
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

async function deployFixture() {
  const [deployer, solver1, solver2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const USDC = await hre.viem.deployContract("MockToken", ["USDC", "USDC"]);

  const settleMaker = await loadFixture(shouldDeploySettleMaker);
  const pSymmSettlement = await hre.viem.deployContract("pSymmSettlement", [
    settleMaker.address,
    "pSymm Settlement",
    "1.0",
  ]);


  const pSymm = await hre.viem.deployContract("pSymm");

  await USDC.write.mint([deployer.solver1.address], [parseEther("1000000")], {
    account: deployer.solver1,
  });

  await USDC.write.mint([deployer.solver2.address], [parseEther("1000000")], {
    account: deployer.solver2,
  });

  await USDC.write.approve([pSymm.address], [parseEther("1000000")], {
    account: deployer.solver1,
  });

  await USDC.write.approve([pSymm.address], [parseEther("1000000")], {
    account: deployer.solver2,
  });

  const solver1CustodyRollupId = keccak256(abi.encodePacked(deployer.solver1.address, deployer.solver1.address, 0));
  const solver2CustodyRollupId = keccak256(abi.encodePacked(deployer.solver2.address, deployer.solver2.address, 0));
  await pSymm.write.deposit(USDC.address, parseEther("1000000"), solver1CustodyRollupId);
  await pSymm.write.deposit(USDC.address, parseEther("1000000"), solver2CustodyRollupId);
  

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

  // Create merkle tree with all initial settlements
  const merkleTree = createInitialMerkleTree([
    [validatorEditId],
    [batchMetadataEditId],
    [batchMetadataId],
  ]);

  // Deploy SettleMaker with EditSettlement address and merkle root
  const settleMakerContract = await hre.viem.deployContract("SettleMaker", [
    editSettlement.address,
    mockSymm.address,
    merkleTree.root,
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



module.exports = {
  shouldDeploySettleMaker,
  deployFixture,
  getSettlementIdFromReceipt,
};
