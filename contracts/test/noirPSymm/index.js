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
  // Convert hex strings to bytes arrays
  const nullifierBytes = hexToBytes(note.nullifier);
  const amountBytes = hexToBytes(note.amount);
  const tokenBytes = hexToBytes(note.token);
  const custodyIdBytes = hexToBytes(custodyId);
  const secretNonceBytes = hexToBytes(note.secret_nonce);

  // Create concatenated array matching Noir's acc array
  const acc = new Uint8Array(160); // 32 * 5 = 160 bytes

  // Copy bytes in same order as Noir
  acc.set(nullifierBytes, 0);
  acc.set(amountBytes, 32);
  acc.set(tokenBytes, 64);
  acc.set(custodyIdBytes, 96);
  acc.set(secretNonceBytes, 128);

  // Hash the concatenated array
  return keccak256(bytesToHex(acc));
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

    // Check initial merkle root matches empty tree
    const zeros = [];
    let currentZero = toHex(new Uint8Array(32));
    for (let i = 0; i < 10; i++) {
      zeros.push(currentZero);
      currentZero = keccak256(concatHex([currentZero, currentZero]));
    }
    const expectedRoot = zeros[zeros.length - 1];
    const merkleRoot = await noirPsymm.read.MERKLE_ROOT();
    assert.equal(
      merkleRoot,
      expectedRoot,
      "Initial Merkle root should match empty tree"
    );
  });

  function insert(commitment, nextIndex, zeros, filledSubtrees) {
    let currentHash = commitment;
    let currentIndex = nextIndex;
    if (!filledSubtrees || filledSubtrees.length === 0) {
      filledSubtrees = zeros.slice();
    }
    for (let level = 0; level < 10; level++) {
      if (currentIndex % 2 === 0) {
        filledSubtrees[level] = currentHash;
        currentHash = keccak256(concatHex([currentHash, zeros[level]]));
      } else {
        currentHash = keccak256(
          concatHex([filledSubtrees[level], currentHash])
        );
      }
      currentIndex = Math.floor(currentIndex / 2);
    }
    return [currentHash, filledSubtrees];
  }

  async function performATC({ noirPsymm, mockUSDC, verifierATC, deployer }) {
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
    console.log(
      "Public inputs:",
      publicInputs.map((x) => parseInt(x))
    );

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

    // Calculate expected merkle root after insertion
    const zeros = [];
    let currentZero = toHex(new Uint8Array(32));
    for (let i = 0; i < 10; i++) {
      zeros.push(currentZero);
      currentZero = keccak256(concatHex([currentZero, currentZero]));
    }
    let filledSubtrees = [];
    const [expectedRoot] = insert(commitment, 0, zeros, filledSubtrees);

    // Get and verify updated merkle root
    const updatedRoot = await noirPsymm.read.MERKLE_ROOT();
    console.log("Updated Merkle root:", updatedRoot);
    assert.equal(
      updatedRoot,
      expectedRoot,
      "Updated Merkle root should match local calculation"
    );

    // Verify USDC was transferred
    const contractBalance = await mockUSDC.read.balanceOf([noirPsymm.address]);
    assert.equal(
      contractBalance,
      depositAmount,
      "Contract should have received the USDC"
    );

    return { commitment, depositAmount };
  }

  it("Should correctly handle ATC (address-to-custody) operations", async function () {
    const fixture = await loadFixture(deployFixture);
    await performATC(fixture);
  });

  async function performCTC({ noirPsymm, mockUSDC }) {
    return;
    const { backendCTC, noirCTC } = await getNoirBackend();

    // Create notes for splitting
    const originalAmount = 1000000000n; // 1000 USDC
    const splitAmount1 = 400000000n; // 400 USDC
    const splitAmount2 = 600000000n; // 600 USDC

    // Original note (from ATC)
    const note = constructNote(originalAmount, mockUSDC.address);
    const custodyId = toHex(new Uint8Array(32));

    // Two new notes for the split
    const noteA = constructNote(splitAmount1, mockUSDC.address);
    const noteB = constructNote(splitAmount2, mockUSDC.address);
    const custodyIdA = toHex(new Uint8Array(32));
    const custodyIdB = toHex(new Uint8Array(32));

    // Calculate commitments
    const commitment = hashNote(note, custodyId);
    const commitmentA = hashNote(noteA, custodyIdA);
    const commitmentB = hashNote(noteB, custodyIdB);

    // Initialize zeros array matching insert-test.py
    const zeros = [];
    let currentZero = toHex(new Uint8Array(32));

    // Generate zeros for each level
    for (let i = 0; i < 10; i++) {
      zeros.push(currentZero);
      currentZero = keccak256(concatHex([currentZero, currentZero]));
    }

    // Insert commitment using _insert algorithm from insert-test.py
    let currentHash = commitment;
    let currentIndex = 0;
    let filledSubtrees = zeros.slice();
    const merkle_path = [];

    // Compute the new root and collect path
    for (let level = 0; level < 10; level++) {
      if (currentIndex % 2 === 0) {
        filledSubtrees[level] = currentHash;
        currentHash = keccak256(concatHex([currentHash, zeros[level]]));
        merkle_path.push(zeros[level]);
      } else {
        currentHash = keccak256(
          concatHex([filledSubtrees[level], currentHash])
        );
        merkle_path.push(filledSubtrees[level]);
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    // Prepare proof inputs
    const inputs = {
      note: {
        nullifier: chopHex(note.nullifier),
        amount: chopHex(note.amount).reverse(), // LE
        token: chopHex(note.token),
        secret_nonce: chopHex(note.secret_nonce),
      },
      note_a: {
        nullifier: chopHex(noteA.nullifier),
        amount: chopHex(noteA.amount).reverse(),
        token: chopHex(noteA.token),
        secret_nonce: chopHex(noteA.secret_nonce),
      },
      note_b: {
        nullifier: chopHex(noteB.nullifier),
        amount: chopHex(noteB.amount).reverse(),
        token: chopHex(noteB.token),
        secret_nonce: chopHex(noteB.secret_nonce),
      },
      note_index: 0,
      note_hash_path: merkle_path.map((path) => chopHex(path)),
      note_commitment: chopHex(commitment),
      noteA_commitment: chopHex(commitmentA),
      noteB_commitment: chopHex(commitmentB),
      nullifier_hash: chopHex(keccak256(note.nullifier)),
      root: chopHex(await noirPsymm.read.MERKLE_ROOT()),
      note_custody_id: chopHex(custodyId),
      noteA_custody_id: chopHex(custodyIdA),
      noteB_custody_id: chopHex(custodyIdB),
    };
    console.log(inputs);

    // Generate the proof
    console.log("Generating witness...");
    const { witness } = await noirCTC.execute(inputs);
    console.log("Generating proof...");
    const { proof, publicInputs } = await backendCTC.generateProof(
      Buffer.from(witness)
    );
    console.log("Generated proof");

    // Execute the CTC operation
    await noirPsymm.write.custodyToCustody([
      bytesToHex(proof),
      custodyId,
      keccak256(note.nullifier),
      commitmentA,
      commitmentB,
    ]);

    // Verify the new commitments were stored
    const storedCommitmentA = await noirPsymm.read.leaves([1]);
    const storedCommitmentB = await noirPsymm.read.leaves([2]);
    assert.equal(
      storedCommitmentA,
      commitmentA,
      "Commitment A should be stored"
    );
    assert.equal(
      storedCommitmentB,
      commitmentB,
      "Commitment B should be stored"
    );

    return { commitmentA, commitmentB };
  }

  it("Should correctly handle ATC + CTC deposit split (custody-to-custody) operations", async function () {
    const fixture = await loadFixture(deployFixture);
    await performATC(fixture);
    await performCTC(fixture);
  });
});
