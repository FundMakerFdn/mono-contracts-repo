const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");
const { keccak256, concat, toBytes } = require("viem");

function hashNote(note, custodyId) {
  // Convert amounts to little-endian bytes if they're numbers
  const amount = typeof note.amount === 'number' || typeof note.amount === 'bigint' 
    ? toBytes(note.amount, { size: 32, endian: 'little' })
    : note.amount;

  // Concatenate all fields in order matching Noir:
  // nullifier (32) + amount (32) + token (32) + custody_id (32) + secret_nonce (32)
  const concatenated = concat([
    note.nullifier,
    amount,
    note.token,
    custodyId,
    note.secret_nonce
  ]);

  // Hash with keccak256
  return keccak256(concatenated);
}

async function deployFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy the verifier
  const verifier = await hre.viem.deployContract(
    "contracts/src/noirPsymm/VerifierCTC.sol:UltraVerifier"
  );

  // Deploy noirPsymm with the verifier address
  const noirPsymm = await hre.viem.deployContract("noirPsymm", [
    verifier.address,
  ]);

  // Deploy MockUSDC
  const mockUSDC = await hre.viem.deployContract("MockUSDC");

  // Mint 10000 USDC to deployer (with 6 decimals like real USDC)
  await mockUSDC.write.mint([deployer.account.address, 10000000000n]);

  return {
    noirPsymm,
    mockUSDC,
    deployer,
    publicClient,
  };
}

describe("noirPsymm", function () {
  it("Should deploy successfully and initialize merkle root", async function () {
    const { noirPsymm } = await loadFixture(deployFixture);

    // Verify contract was deployed by checking address exists
    assert(
      noirPsymm.address,
      "Contract should have an address after deployment"
    );

    // Check initial merkle root is set
    const merkleRoot = await noirPsymm.read.MERKLE_ROOT();
    console.log(merkleRoot);
    assert(merkleRoot, "Merkle root should be initialized");
  });

  it("Should correctly deposit USDC into custody (addressToCustody)", async function () {
    const { noirPsymm, mockUSDC, deployer } = await loadFixture(deployFixture);

    // Test commitment matching Python test
    // const commitment =
    //   "0x1cb1b16d77322dc69122683e8d4576fa3a1315a6a8231ce36fb5b3913f44a93a";
    const depositAmount = 1000000000n; // 1000 USDC with 6 decimals

    // Approve noirPsymm to spend USDC
    await mockUSDC.write.approve([noirPsymm.address, depositAmount]);

    // Deposit into custody
    await noirPsymm.write.addressToCustody([
      commitment,
      depositAmount,
      mockUSDC.address,
    ]);

    // Verify the commitment was stored
    const storedCommitment = await noirPsymm.read.leaves([0]);
    assert.equal(
      storedCommitment,
      commitment,
      "Commitment should be stored in leaves mapping"
    );

    // Verify next index was incremented
    const nextIndex = await noirPsymm.read.nextIndex();
    console.log("Next index:", nextIndex);
    assert.equal(nextIndex, 1, "Next index should be incremented to 1");

    // Get and print updated merkle root
    const updatedRoot = await noirPsymm.read.MERKLE_ROOT();
    console.log("Updated Merkle root:", updatedRoot);

    // Verify USDC was transferred
    const contractBalance = await mockUSDC.read.balanceOf([noirPsymm.address]);
    assert.equal(
      contractBalance,
      depositAmount,
      "Contract should have received the USDC"
    );
  });
});
