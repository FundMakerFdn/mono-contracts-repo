const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // First deploy the verifier
  const verifier = await hre.viem.deployContract(
    "contracts/src/noirPsymm/VerifierCTC.sol:UltraVerifier"
  );

  // Then deploy noirPsymm with the verifier address
  const noirPsymm = await hre.viem.deployContract("noirPsymm", [verifier.address]);

  return {
    noirPsymm,
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
});
