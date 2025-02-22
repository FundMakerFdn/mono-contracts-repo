const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { bytesToHex } = require("viem");
const { UltraPlonkBackend } = require("@aztec/bb.js");
const { Noir } = require("@noir-lang/noir_js");
const path = require("path");
const fs = require("fs");
const hre = require("hardhat");

let iota = 0;

async function deployFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Initialize the Barretenberg backend
  const jsondata = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../../noir/pSymm/target/pSymm.json")
    )
  );
  const backend = new UltraPlonkBackend(jsondata.bytecode);
  const noir = new Noir(jsondata);

  // Deploy NoirTest contract
  const noirTest = await hre.viem.deployContract("NoirTest");

  return {
    noirTest,
    noir,
    backend,
    deployer,
    publicClient,
  };
}

describe("NoirTest", function () {
  it("Should verify a valid proof", async function () {
    const { noirTest, backend, noir } = await loadFixture(deployFixture);

    const x = 5;
    const y = 6; // x != y

    // Generate the proof

    console.log("generating witness...");
    const { witness } = await noir.execute({ x, y });
    console.log("generating proof...");
    const { proof, publicInputs } = await backend.generateProof(witness);

    const proofHex = bytesToHex(proof);
    const result = await noirTest.read.verify([proofHex, publicInputs[0]]);
    assert.equal(result, true, "Valid proof should verify");
  });
});
//

// module.exports = { deployFixture };
