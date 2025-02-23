const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, user1, user2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy MockPPM
  const noirPsymm = await hre.viem.deployContract("noirPsymm");

  return {
    noirPsymm,
    deployer,
    user1,
    user2,
    publicClient
  };
}

function shouldDeployNoirPsymm() {
  it("should deploy successfully", async function () {
    const { noirPsymm } = await loadFixture(deployFixture);
    assert.ok(noirPsymm.address, "noirPsymm not deployed");
  });
}

module.exports = {
  shouldDeployNoirPsymm,
  deployFixture
};
