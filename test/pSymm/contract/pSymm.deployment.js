const assert = require("node:assert/strict");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  keccak256,
  toHex,
  decodeEventLog,
} = require("viem");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");

// Helper to create merkle tree from settlements
function createInitialMerkleTree(leaves) {
  return StandardMerkleTree.of(leaves, ["bytes32"]);
}

async function deployFixture() {
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy mock SYMM token first
  const mockSymm = await hre.viem.deployContract("MockSymm");

  // Deploy EditSettlement first without SettleMaker
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

  // Create batch metadata settlement
  const createTx = await batchMetadataSettlement.write.createBatchMetadataSettlement(
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
  const validatorWhitelistTx = await validatorSettlement.write.createValidatorSettlement(
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
  await mockSymm.write.approve([validatorSettlement.address, parseEther("1000")], {
    account: deployer.account,
  });

  // Create merkle tree with all initial settlements
  const merkleTree = createInitialMerkleTree([
    [validatorEditId],
    [batchMetadataEditId],
    [batchMetadataId],
    [validatorWhitelistId],
  ]);

  // Deploy SettleMaker with EditSettlement address and merkle root
  const settleMaker = await hre.viem.deployContract("SettleMaker", [
    editSettlement.address,
    mockSymm.address,
    merkleTree.root,
  ]);

  // Set SettleMaker addresses in settlements
  await editSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  await batchMetadataSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

  // Execute batch metadata edit settlement first
  const batchMetadataProof = merkleTree.getProof([batchMetadataEditId]);
  await editSettlement.write.executeSettlement(
    [0n, batchMetadataEditId, batchMetadataProof],
    { account: deployer.account }
  );

  // Execute validator edit settlement second
  const validatorProof = merkleTree.getProof([validatorEditId]);
  await editSettlement.write.executeSettlement(
    [0n, validatorEditId, validatorProof],
    { account: deployer.account }
  );

  // Execute the batch metadata settlement last
  const proof = merkleTree.getProof([batchMetadataId]);
  await batchMetadataSettlement.write.executeSettlement(
    [0n, batchMetadataId, proof],
    { account: deployer.account }
  );

  // Deploy pSymm contract
  const pSymm = await hre.viem.deployContract("pSymm");

  // Deploy pSymmSettlement contract with SettleMaker address, name, and version
  const pSymmSettlement = await hre.viem.deployContract("pSymmSettlement", [
    settleMaker.address,
    "pSymmSettlement",
    "1.0",
  ]);

  // Set pSymmSettlement address in SettleMaker
  await settleMaker.write.setpSymmSettlement([pSymmSettlement.address], {
    account: deployer.account,
  });

  // Mint SYMM tokens to parties for staking
  await mockSymm.write.mint([partyA.account.address, parseEther("1000")], {
    account: deployer.account,
  });
  await mockSymm.write.mint([partyB.account.address, parseEther("1000")], {
    account: deployer.account,
  });

  // Approve SYMM tokens for pSymmSettlement
  await mockSymm.write.approve([pSymmSettlement.address, parseEther("1000")], {
    account: partyA.account,
  });
  await mockSymm.write.approve([pSymmSettlement.address, parseEther("1000")], {
    account: partyB.account,
  });

  // Create initial merkle tree with empty settlements or predefined settlements
  const pSymmMerkleTree = createInitialMerkleTree([
    // Add initial leaves if required
  ]);

  return {
    mockSymm,
    editSettlement,
    validatorSettlement,
    batchMetadataSettlement,
    settleMaker,
    pSymm,
    pSymmSettlement,
    deployer,
    partyA,
    partyB,
    publicClient,
    merkleTree,
    pSymmMerkleTree,
  };
}

function shouldDeployPSymm() {
  it("should deploy pSymm and pSymmSettlement with correct initial state", async function () {
    const { pSymm, pSymmSettlement, settleMaker, deployer } = await loadFixture(deployFixture);

    // Verify pSymm deployment
    const pSymmAddress = await pSymm.read.address();
    assert.ok(pSymmAddress, "pSymm contract was not deployed");

    // Verify pSymmSettlement deployment
    const pSymmSettlementAddress = await pSymmSettlement.read.address();
    assert.ok(pSymmSettlementAddress, "pSymmSettlement contract was not deployed");

    // Check SettleMaker configuration in pSymmSettlement
    const settleMakerAddress = await pSymmSettlement.read.settleMaker();
    assert.equal(
      getAddress(settleMakerAddress),
      getAddress(settleMaker.address),
      "Incorrect SettleMaker address in pSymmSettlement"
    );

    const name = await pSymmSettlement.read.name();
    assert.equal(name, "pSymmSettlement", "Incorrect settlement name");

    const version = await pSymmSettlement.read.version();
    assert.equal(version, "1.0", "Incorrect settlement version");
  });

  it("should allow depositing and withdrawing collateral", async function () {
    const { pSymm, pSymmSettlement, deployer, partyA } = await loadFixture(deployFixture);

    const collateralToken = pSymm.address; // Assuming pSymm is the collateral token
    const collateralAmount = parseEther("100");

    // Deposit collateral
    await pSymmSettlement.write.deposit([collateralToken, collateralAmount, 1], {
      account: partyA.account,
    });

    const balance = await pSymmSettlement.read.custodyRollupBalances([
      "0xCustodyRollupId",
      collateralToken,
    ]);
    assert.equal(balance.toString(), collateralAmount.toString(), "Collateral deposit failed");

    // Withdraw collateral
    await pSymmSettlement.write.withdraw([collateralToken, collateralAmount, 1], {
      account: partyA.account,
    });

    const updatedBalance = await pSymmSettlement.read.custodyRollupBalances([
      "0xCustodyRollupId",
      collateralToken,
    ]);
    assert.equal(updatedBalance.toString(), "0", "Collateral withdrawal failed");
  });

  it("should execute early agreement correctly", async function () {
    const { pSymm, pSymmSettlement, deployer, partyA, partyB } = await loadFixture(deployFixture);

    const settlementId = "0xSettlementId";
    const custodyRollupTarget = "0xCustodyRollupTarget";
    const custodyRollupReceiver = "0xCustodyRollupReceiver";
    const collateralToken = pSymm.address;
    const collateralAmount = parseEther("50");
    const expiration = BigInt(await time.latest()) + BigInt(1000);
    const nonce = "0xNonce";
    const signature = "0xSignature"; // Replace with actual signature

    await pSymmSettlement.write.executeEarlyAgreement(
      [
        settlementId,
        custodyRollupTarget,
        custodyRollupReceiver,
        collateralToken,
        collateralAmount,
        expiration,
        nonce,
        signature,
      ],
      {
        account: partyA.account, // or partyB.account depending on the agreement
      }
    );

    const settlementState = await pSymmSettlement.read.pSymmSettlementDatas([
      settlementId,
      "state",
    ]);
    assert.equal(settlementState, 1, "Early agreement did not execute correctly");
  });

  it("should execute instant withdraw correctly", async function () {
    const { pSymm, pSymmSettlement, deployer, partyA, partyB } = await loadFixture(deployFixture);

    const settlementId = "0xSettlementId";
    const replacedParty = partyA.account.address;
    const instantWithdrawFee = parseEther("10");
    const isA = true;
    const signature = "0xSignature"; // Replace with actual signature

    await pSymmSettlement.write.executeInstantWithdraw(
      [
        settlementId,
        replacedParty,
        instantWithdrawFee,
        isA,
        signature,
      ],
      {
        account: deployer.account,
      }
    );

    const settlementState = await pSymmSettlement.read.pSymmSettlementDatas([
      settlementId,
      "state",
    ]);
    assert.equal(settlementState, 2, "Instant withdraw did not execute correctly");
  });

  it("should not allow executing settlement with invalid signature", async function () {
    const { pSymm, pSymmSettlement, deployer, partyA } = await loadFixture(deployFixture);

    const settlementId = "0xInvalidSettlementId";
    const custodyRollupTarget = "0xInvalidCustodyRollupTarget";
    const custodyRollupReceiver = "0xInvalidCustodyRollupReceiver";
    const collateralToken = pSymm.address;
    const collateralAmount = parseEther("50");
    const expiration = BigInt(await time.latest()) + BigInt(1000);
    const nonce = "0xInvalidNonce";
    const signature = "0xInvalidSignature";

    await assert.rejects(
      async () => {
        await pSymmSettlement.write.executeEarlyAgreement(
          [
            settlementId,
            custodyRollupTarget,
            custodyRollupReceiver,
            collateralToken,
            collateralAmount,
            expiration,
            nonce,
            signature,
          ],
          {
            account: partyA.account,
          }
        );
      },
      {
        message: /Invalid signature/,
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
  shouldDeployPSymm,
  deployFixture,
  getSettlementIdFromReceipt,
};
