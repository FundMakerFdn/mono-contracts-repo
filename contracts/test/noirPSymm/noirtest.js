const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  bytesToHex,
  concat,
  toHex,
  hexToBytes,
  encodeAbiParameters,
  parseAbiParameters,
} = require("viem");
const { NativeUltraPlonkBackend } = require("./plonk.js");
const { Noir } = require("@noir-lang/noir_js");
const path = require("path");
const fs = require("fs");
const hre = require("hardhat");
const TOML = require("@iarna/toml");

async function deployFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Initialize the Barretenberg backend
  const jsondata = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../../noir/pSymm/target/pSymm.json")
    )
  );
  const backend = new NativeUltraPlonkBackend("/home/qbit/.bb/bb", jsondata);
  const noir = new Noir(jsondata);

  // Deploy NoirTest contract
  const verifier = await hre.viem.deployContract(
    "contracts/src/noirPsymm/VerifierCTC.sol:UltraVerifier"
  );

  return {
    verifier,
    noir,
    backend,
    deployer,
    publicClient,
  };
}

describe("NoirTest pSymm", function () {
  it("Should verify a valid proof for note splitting", async function () {
    const { verifier, backend, noir } = await loadFixture(deployFixture);

    // Load test data from Prover.toml
    const tomlData = TOML.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../../../noir/pSymm/Prover.toml"),
        "utf8"
      )
    );

    // Format inputs for proof generation
    // const inputs = {
    //   note: tomlData.note,
    //   note_a: tomlData.note_a,
    //   note_b: tomlData.note_b,
    //   note_index: tomlData.note_index,
    //   note_hash_path: tomlData.note_hash_path,
    //   note_commitment: tomlData.note_commitment,
    //   noteA_commitment: tomlData.noteA_commitment,
    //   noteB_commitment: tomlData.noteB_commitment,
    //   nullifier_hash: tomlData.nullifier_hash,
    //   root: tomlData.root,
    //   note_custody_id: tomlData.note_custody_id,
    //   noteA_custody_id: tomlData.noteA_custody_id,
    //   noteB_custody_id: tomlData.noteB_custody_id,
    // };
    console.log("inputs", tomlData);

    // Generate the proof
    console.log("generating witness...");
    const { witness } = await noir.execute(tomlData);
    console.log("generating proof...");
    const { proof, publicInputs } = await backend.generateProof(
      Buffer.from(witness)
    );
    console.log("publicInputs", publicInputs);

    const proofHex = bytesToHex(proof);
    const result = await verifier.read.verify([proofHex, publicInputs]);
    assert.equal(result, true, "Valid proof should verify");
  });
});
