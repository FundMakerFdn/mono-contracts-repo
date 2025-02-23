const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { createWalletClient, http } = require("viem");
const hre = require("hardhat");
const { CHAIN_ID, partyAKey, partyBKey } = require("./globalVariables");

async function deployTestFixture() {
  const [deployer] = await hre.viem.getWalletClients();
  const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
  
  const partyA = createWalletClient({
    account: partyAKey, 
    chain: CHAIN_ID.HARDHAT,
    transport: http(rpcUrl)
  });
  const partyB = createWalletClient({
    account: partyBKey, 
    chain: CHAIN_ID.HARDHAT,
    transport: http(rpcUrl)
  });

  const publicClient = await hre.viem.getPublicClient();
  const noirPsymm = await hre.viem.deployContract("noirPsymm", []);
  const mockUSDC = await hre.viem.deployContract("MockUSDC", []);
  return { noirPsymm, mockUSDC, deployer, partyA, partyB, publicClient };
}

function shouldDeployNoirPsymm() {
  it("should deploy successfully", async function () {
    const { noirPsymm } = await loadFixture(deployTestFixture);
    assert.ok(noirPsymm.address, "noirPsymm not deployed");
  });
}

module.exports = {
  shouldDeployNoirPsymm,
  deployTestFixture
};
