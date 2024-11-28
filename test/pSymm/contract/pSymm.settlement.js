const assert = require("node:assert/strict");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  keccak256,
  encodePacked
} = require("viem");
const { deployFixture } = require("./pSymm.deployment");

//TODO initaite pSymm custody rollup

async function shouldOpenSettlement() {
  it("should open a settlement", async function () {
    const { pSymmSettlement, partyA, partyB } = await loadFixture(deployFixture);

    const custodyRollupId = keccak256(encodePacked(['address', 'address', 'uint256'], [partyA.account.address, partyB.account.address, 1]));
    const merkleRoot = keccak256(encodePacked(['string'], ["merkleRoot"]));

    const tx = await pSymmSettlement.write.openSettlement([
      partyA.account.address,
      partyB.account.address,
      custodyRollupId,
      merkleRoot,
      true
    ], {
      account: partyA.account,
    });

    const settlementId = keccak256(encodePacked(
      ['bytes32', 'bytes32', 'bool', 'address', 'uint256', 'uint256'],
      [custodyRollupId, merkleRoot, true, partyA.account.address, tx.blockNumber, tx.blockNumber]
    ));

    const settlementData = await pSymmSettlement.read.getSettlementData([settlementId]);

    assert.equal(
      settlementData.partyA,
      partyA.account.address,
      "Party A address mismatch"
    );
    assert.equal(
      settlementData.partyB,
      partyB.account.address,
      "Party B address mismatch"
    );
    assert.equal(
      settlementData.custodyRollupId,
      custodyRollupId,
      "Custody Rollup ID mismatch"
    );
    assert.equal(
      settlementData.merkleRootA,
      merkleRoot,
      "Merkle Root mismatch"
    );
  });
}

module.exports = {
  shouldOpenSettlement,
};
