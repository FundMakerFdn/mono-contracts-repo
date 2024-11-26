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
const { getSettlementIdFromReceipt } = require("../../SettleMaker/SettleMaker.deployment");
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
  const mockUSDC = await hre.viem.deployContract("MockToken", ["MockUSDC", "mUSDC"]);

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

  // Mint mockUSDC tokens to partyA and partyB for depositing
  await mockUSDC.write.mint([partyA.account.address, parseEther("1000")], {
    account: deployer.account,
  });
  await mockUSDC.write.mint([partyB.account.address, parseEther("1000")], {
    account: deployer.account,
  });

  // Ensure mockUSDC is approved for pSymm before depositing
  await mockUSDC.write.approve([pSymm.address, parseEther("1000")], {
    account: partyA.account,
  });
  await mockUSDC.write.approve([pSymm.address, parseEther("1000")], {
    account: partyB.account,
  });

  // Now proceed with the deposit to pSymm
  await pSymm.write.deposit([mockUSDC.address, parseEther("1000"), 1], {
    account: partyA.account,
  });
  await pSymm.write.deposit([mockUSDC.address, parseEther("1000"), 1], {
    account: partyB.account,
  });



  return {
    mockSymm,
    mockUSDC,
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
    merkleTree
  };
}



function shouldDeployPSymm() {
  it("should deploy pSymm and pSymmSettlement with correct initial state", async function () {
    const { pSymm, pSymmSettlement, settleMaker, deployer } = await deployFixture();

    // Verify pSymm deployment
    const pSymmAddress = pSymm.address;
    assert.ok(pSymmAddress, "pSymm contract was not deployed");

    // Verify pSymmSettlement deployment
    const pSymmSettlementAddress = pSymmSettlement.address;
    assert.ok(pSymmSettlementAddress, "pSymmSettlement contract was not deployed");

    // Check SettleMaker configuration in pSymmSettlement
    const settleMakerAddress = await pSymmSettlement.read.settleMaker();
    assert.equal(
      getAddress(settleMakerAddress),
      getAddress(settleMaker.address),
      "Incorrect SettleMaker address in pSymmSettlement"
    );

  });

  
}

 

module.exports = {
  shouldDeployPSymm,
  deployFixture,
};
