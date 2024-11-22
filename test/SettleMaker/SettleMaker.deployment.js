const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, getAddress, keccak256, toHex } = require("viem");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, validator1, validator2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy mock SYMM token first
  const mockSymm = await hre.viem.deployContract("MockSymm");

  debugger;

  // Deploy EditSettlement first without settleMaker
  const editSettlement = await hre.viem.deployContract("EditSettlement", [
    "Edit Settlement",
    "1.0.0",
  ]);

  const validatorSettlement = await hre.viem.deployContract(
    "ValidatorSettlement",
    ["Validator Settlement", "1.0.0"]
  );

  const batchMetadataSettlement = await hre.viem.deployContract(
    "BatchMetadataSettlement",
    ["Batch Metadata Settlement", "1.0.0"]
  );

  // Create initial merkle root with settlements
  const initialRoot = keccak256(toHex("initial root")); // This should be generated properly

  // Deploy SettleMaker with EditSettlement address
  const settleMaker = await hre.viem.deployContract("SettleMaker", [
    editSettlement.address,
    mockSymm.address,
    initialRoot,
  ]);

  // Set SettleMaker in EditSettlement
  await editSettlement.write.setSettleMaker([settleMaker.address], {
    account: deployer.account,
  });

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
  };
}

function shouldDeploySettleMaker() {
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
    assert.equal(metadata.votingStart, 0n);
    assert.equal(metadata.votingEnd, 0n);
  });

  it("should have initial merkle root in batch 0", async function () {
    const { settleMaker } = await loadFixture(deployFixture);

    const initialRoot = await settleMaker.read.batchSoftFork([0n]);
    assert.notEqual(
      initialRoot,
      "0x" + "0".repeat(64),
      "Initial root should not be zero"
    );
  });

  it("should start in PAUSE state", async function () {
    const { settleMaker } = await loadFixture(deployFixture);

    const currentState = await settleMaker.read.getCurrentState();
    assert.equal(currentState, 0, "Initial state should be PAUSE");
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
};
