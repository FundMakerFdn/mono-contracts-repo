const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { bytesToHex, toHex } = require("viem");
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
      path.resolve(__dirname, "../../../noir/merkle/target/pSymm.json")
    )
  );
  const backend = new UltraPlonkBackend(jsondata.bytecode, { threads: 32 });
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

    const leaf = [
      114, 172, 58, 74, 190, 127, 133, 9, 11, 63, 108, 129, 134, 243, 30, 252,
      177, 10, 196, 126, 16, 225, 30, 189, 205, 80, 117, 7, 7, 87, 216, 213,
    ];

    const index = 2;

    const hash_path = [
      [
        67, 172, 14, 118, 255, 19, 245, 209, 172, 77, 245, 188, 190, 143, 204,
        76, 135, 88, 229, 3, 222, 59, 125, 133, 212, 105, 84, 91, 74, 185, 251,
        71,
      ],
      [
        208, 78, 65, 115, 206, 133, 247, 163, 247, 9, 82, 202, 197, 51, 243,
        110, 77, 234, 166, 55, 39, 164, 44, 136, 19, 15, 33, 58, 175, 96, 57, 1,
      ],
      [
        8, 245, 83, 157, 193, 165, 51, 50, 122, 18, 115, 126, 108, 208, 78, 246,
        121, 55, 43, 11, 42, 212, 234, 94, 193, 253, 107, 192, 185, 125, 65, 47,
      ],
    ];

    const root = [
      246, 79, 65, 239, 160, 200, 170, 170, 23, 163, 234, 215, 13, 229, 172, 86,
      98, 194, 179, 141, 68, 226, 41, 52, 135, 107, 3, 72, 181, 171, 191, 36,
    ];

    // Generate the proof

    console.log("generating witness...");
    const { witness } = await noir.execute({ leaf, index, hash_path, root });
    console.log("generating proof...");
    const { proof, publicInputs } = await backend.generateProof(witness);

    const pInp = [];
    for (let e of publicInputs) {
      pInp.push(parseInt(e));
    }
    console.log("Public input:", toHex(pInp));

    const proofHex = bytesToHex(proof);
    const result = await noirTest.read.verify([proofHex, toHex(pInp)]);
    assert.equal(result, true, "Valid proof should verify");
  });
});
//

// module.exports = { deployFixture };
