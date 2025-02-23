const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { keccak256, toHex } = require("viem");
const hre = require("hardhat");
const { deployTestFixture } = require("./noirPsymm.deployment");

function shouldInsert() {
describe("Test _insert", function () {
  it("should insert a commitment and update leaves and nextIndex", async function () {
    const { noirPsymm, partyA, publicClient } = await loadFixture(deployTestFixture);
    const commitment = keccak256(toHex("testInsertCommitment"));
    const tx = await noirPsymm.write._insert([commitment], { account: partyA.account });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    const nextIndex = await noirPsymm.read.nextIndex([]);
    assert.equal(Number(nextIndex), 1);
    const storedCommitment = await noirPsymm.read.leaves([0]);
    assert.equal(storedCommitment, commitment);
  });

  it("should perform multiple insertions correctly", async function () {
    const { noirPsymm, partyA, publicClient } = await loadFixture(deployTestFixture);
    const commitment1 = keccak256(toHex("commitment1"));
    const commitment2 = keccak256(toHex("commitment2"));
    const tx1 = await noirPsymm.write._insert([commitment1], { account: partyA.account });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    const tx2 = await noirPsymm.write._insert([commitment2], { account: partyA.account });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    const nextIndex = await noirPsymm.read.nextIndex([]);
    assert.equal(Number(nextIndex), 2);
    const storedCommitment1 = await noirPsymm.read.leaves([0]);
    const storedCommitment2 = await noirPsymm.read.leaves([1]);
    assert.equal(storedCommitment1, commitment1);
    assert.equal(storedCommitment2, commitment2);
  });
});
}

module.exports = { shouldInsert };
