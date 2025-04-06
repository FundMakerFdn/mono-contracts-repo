const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, user1, user2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  const PSYMM = await hre.viem.deployContract("PSYMM");
  const ETFMaker = await hre.viem.deployContract("ETFMaker", {
    args: [PSYMM.address]
  });
  

  return {
    PSYMM,
    ETFMaker,
    deployer,
    user1,
    user2,
    publicClient
  };
}

function shouldDeployPSYMM() {
  it("should deploy successfully", async function () {
    const { PSYMM } = await loadFixture(deployFixture);
    assert.ok(PSYMM.address, "PSYMM not deployed");
  });
}-

module.exports = {
  shouldDeployPSYMM,
  deployFixture
};
