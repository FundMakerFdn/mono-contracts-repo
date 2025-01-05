const assert = require("node:assert/strict");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  keccak256,
  toHex,
  decodeEventLog,
  encodePacked
} = require("viem");
const { deployFixture } = require("./pSymm.deployment");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");

async function custodyId(pSymm, partyA, partyB, id) {
  return await pSymm.read.getRollupBytes32([partyA, partyB, id]);
}


/**
 * Simulates the getRollupBytes32 Solidity function off-chain using viem.
 * @param {string} a - The first Ethereum address.
 * @param {string} b - The second Ethereum address.
 * @param {number|string|BigInt} id - The ID to be included in the hash.
 * @returns {string} The resulting bytes32 hash as a string.
 */
function getRollupBytes32(a, b, id) {
    // Convert id to BigInt if it's not already
    const idBigInt = BigInt(id);
    // Compute the keccak256 hash of the concatenated inputs
    const hash = keccak256(encodePacked(['address', 'address', 'uint256'], [a, b, idBigInt]));

    return hash;
}

// Export the function
module.exports = { getRollupBytes32 };


async function shouldDepositAndWithdrawCollateral() {
  // check getRollupBytes32 and custodyId are the same
  
  it("should allow depositing and withdrawing collateral", async function () {
    const { pSymm, pSymmSettlement, mockUSDC, deployer, partyA, partyB } =
      await loadFixture(deployFixture);

    // minting is done in deployFixture
    // await mockUSDC.write.mint([partyA.account.address, parseEther("1000")], {
    //   account: deployer.account,
    // });
    await mockUSDC.write.approve([pSymm.address, parseEther("1000")], {
      account: partyA.account,
    });
    const collateralToken = mockUSDC.address; // Assuming pSymm is the collateral token
    const collateralAmount = parseEther("1000");

    // Check ERC20 balance before deposit
    const initialERC20Balance = await mockUSDC.read.balanceOf([
      partyA.account.address,
    ]);
    assert.equal(
      initialERC20Balance.toString(),
      collateralAmount.toString(),
      "Initial ERC20 balance incorrect"
    );

    // Deposit collateral
    // Print pSymm rollup balances before deposit
    const preDepositBalance = await pSymm.read.custodyBalances([
      await custodyId(
        pSymm,
        partyA.account.address,
        partyA.account.address,
        1
      ),
      collateralToken,
    ]);
 
  

    await pSymm.write.deposit([collateralToken, collateralAmount, 1], {
      account: partyA.account,
    });

    const balance = await pSymm.read.custodyBalances([
      await custodyId(
        pSymm,
        partyA.account.address,
        partyA.account.address,
        1
      ),
      collateralToken,
    ]);
    assert.equal(
      balance.toString(),
      collateralAmount.toString(),
      "Collateral deposit failed"
    );

    // Check ERC20 balance after deposit
    const postDepositERC20Balance = await mockUSDC.read.balanceOf([
      partyA.account.address,
    ]);
    assert.equal(
      postDepositERC20Balance.toString(),
      "0",
      "ERC20 balance after deposit incorrect"
    );

    // Withdraw collateral
    await pSymm.write.withdraw([collateralToken, collateralAmount, 1], {
      account: partyA.account,
    });

    const updatedBalance = await pSymm.read.custodyBalances([
      await custodyId(
        pSymm,
        partyA.account.address,
        partyA.account.address,
        1
      ),
      collateralToken,
    ]);
    assert.equal(
      updatedBalance.toString(),
      "0",
      "Collateral withdrawal failed"
    );

    // Check ERC20 balance after withdrawal
    const finalERC20Balance = await mockUSDC.read.balanceOf([
      partyA.account.address,
    ]);
    assert.equal(
      finalERC20Balance.toString(),
      parseEther("1000").toString(),
      "Final ERC20 balance incorrect"
    );
  });

  it("should verify getRollupBytes32 and custodyId produce the same result", async function () {
    const { pSymm, partyA } = await loadFixture(deployFixture);

    const expectedRollupId = getRollupBytes32(
      partyA.account.address,
      partyA.account.address,
      1
    );
    const actualRollupId = await custodyId(
      pSymm,
      partyA.account.address,
      partyA.account.address,
      1
    );

    assert.equal(
      actualRollupId,
      expectedRollupId,
      "getRollupBytes32 and custodyId do not match"
    );
  });

}

module.exports = {
  shouldDepositAndWithdrawCollateral,
  getRollupBytes32,
};
