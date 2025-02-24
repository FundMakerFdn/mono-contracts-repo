const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");
const {
  keccak256,
  concat,
  concatHex,
  toBytes,
  toHex,
  hexToBytes,
  bytesToHex,
  pad,
} = require("viem");
const { NativeUltraPlonkBackend } = require("./plonk.js");
const { Noir } = require("@noir-lang/noir_js");
const path = require("path");
const os = require("node:os");

const jsondataATC = require("#root/noir/pSymmATC/target/pSymmATC.json");
const jsondataCTC = require("#root/noir/pSymmCTC/target/pSymmCTC.json");

function chopHex(bytes32hex) {
  // Convert hex string to uint8array
  const bytes = hexToBytes(bytes32hex);
  // Convert each byte back to hex and pad to 2 digits
  return Array.from(bytes).map((b) => parseInt(toHex(b, { size: 1 })));
}

function hashNote(note, custodyId) {
  // Concatenate all fields in order matching Noir:
  // nullifier (32) + amount (32) + token (32) + custody_id (32) + secret_nonce (32)
  const concatenated = concatHex([
    note.nullifier,
    note.amount,
    note.token,
    custodyId,
    note.secret_nonce,
  ]);

  // Hash with keccak256
  return keccak256(concatenated);
}

function constructNote(amount, token) {
  return {
    nullifier: bytesToHex(new Uint8Array(32)), // 32 bytes of zeros
    amount: toHex(amount, { size: 32 }),
    token: pad(token),
    secret_nonce: bytesToHex(new Uint8Array(32)), // 32 bytes of zeros
  };
}

async function getNoirBackend() {
  const backendATC = new NativeUltraPlonkBackend(
    path.join(os.homedir(), ".bb", "bb"),
    jsondataATC
  );
  const backendCTC = new NativeUltraPlonkBackend(
    path.join(os.homedir(), ".bb", "bb"),
    jsondataCTC
  );
  const noirATC = new Noir(jsondataATC);
  const noirCTC = new Noir(jsondataCTC);
  return { backendATC, backendCTC, noirATC, noirCTC };
}

async function deployFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy both verifiers
  const verifierATC = await hre.viem.deployContract(
    "contracts/src/noirPsymm/VerifierATC.sol:UltraVerifier"
  );
  const verifierCTC = await hre.viem.deployContract(
    "contracts/src/noirPsymm/VerifierCTC.sol:UltraVerifier"
  );

  // Deploy noirPsymm with both verifier addresses
  const noirPsymm = await hre.viem.deployContract("noirPsymm", [
    verifierATC.address,
    verifierCTC.address,
  ]);

  // Deploy MockUSDC
  const mockUSDC = await hre.viem.deployContract("MockUSDC");

  // Mint 10000 USDC to deployer (with 6 decimals like real USDC)
  await mockUSDC.write.mint([deployer.account.address, 10000000000n]);

  return {
    noirPsymm,
    mockUSDC,
    verifierATC,
    verifierCTC,
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

  it("Should correctly handle ATC (address-to-custody) operations", async function () {
    const { noirPsymm, mockUSDC, verifierATC, deployer } = await loadFixture(
      deployFixture
    );
    const { backendATC, noirATC } = await getNoirBackend();

    // Create note parameters
    const depositAmount = 1000000000n; // 1000 USDC with 6 decimals
    const note = constructNote(depositAmount, mockUSDC.address);
    const custodyId = toHex(new Uint8Array(32)); // 32 bytes of zeros for now
    console.log(note);

    // Calculate commitment
    const commitment = hashNote(note, custodyId);

    // Prepare proof inputs
    const inputs = {
      nullifier: chopHex(note.nullifier),
      secret_nonce: chopHex(note.secret_nonce),
      custody_id: chopHex(custodyId),
      amount: chopHex(note.amount),
      token: chopHex(note.token),
      commitment: chopHex(commitment),
    };
    console.log("inputs", inputs);

    // Generate the proof
    console.log("Generating witness...");
    const { witness } = await noirATC.execute(inputs);
    console.log("Generating proof...");
    const { proof, publicInputs } = await backendATC.generateProof(
      Buffer.from(witness)
    );
    console.log("Generated proof");
    console.log("Public inputs:", publicInputs.map(x => parseInt(x)));

    // Approve noirPsymm to spend USDC
    await mockUSDC.write.approve([noirPsymm.address, depositAmount]);
    console.log("Preapproved USDC transfer");

    console.log("Calling ATC with params", [
      bytesToHex(proof),
      commitment,
      depositAmount,
      mockUSDC.address,
    ]);
    // Deposit into custody with proof
    await noirPsymm.write.addressToCustody([
      bytesToHex(proof),
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

  it("Should correctly handle CTC (custody-to-custody) operations", async function () {
    const { noirPsymm, mockUSDC, verifierCTC, deployer } = await loadFixture(
      deployFixture
    );

    // Initial deposit to create source note
    const sourceCommitment =
      "0x1cb1b16d77322dc69122683e8d4576fa3a1315a6a8231ce36fb5b3913f44a93a";
    const depositAmount = 1000000000n; // 1000 USDC

    // Approve and deposit initial amount
    await mockUSDC.write.approve([noirPsymm.address, depositAmount]);
    await noirPsymm.write.addressToCustody([
      sourceCommitment,
      depositAmount,
      mockUSDC.address,
    ]);

    // Verify initial deposit state
    const storedCommitment = await noirPsymm.read.leaves([0]);
    assert.equal(
      storedCommitment,
      sourceCommitment,
      "Source commitment should be stored"
    );

    // Get and verify contract balance
    const contractBalance = await mockUSDC.read.balanceOf([noirPsymm.address]);
    assert.equal(
      contractBalance,
      depositAmount,
      "Contract should hold the deposited USDC"
    );
  });
});
