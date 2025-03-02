const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, user1, user2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  const mockPPM = await hre.viem.deployContract("MockPPM");


  return {
    mockPPM,
    deployer,
    user1,
    user2,
    publicClient
  };
}

function shouldDeployMockPPM() {
  it("should deploy successfully", async function () {
    const { mockPPM } = await loadFixture(deployFixture);
    assert.ok(mockPPM.address, "MockPPM not deployed");
  });
}

module.exports = {
  shouldDeployMockPPM,
  deployFixture
};
