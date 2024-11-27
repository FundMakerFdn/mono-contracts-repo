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
} = require("viem");
const { deployFixture } = require("./pSymm.deployment");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");

async function custodyRollupId(pSymm, partyA, partyB, id) {
  return await pSymm.read.getRollupBytes32([partyA, partyB, id]);
}

async function shouldDepositAndWithdrawCollateral() {
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
    const preDepositBalance = await pSymm.read.custodyRollupBalances([
      await custodyRollupId(
        pSymm,
        partyA.account.address,
        partyA.account.address,
        1
      ),
      collateralToken,
    ]);
    console.log(`Balance before deposit: ${preDepositBalance.toString()}`);
    console.log(
      await custodyRollupId(
        pSymm,
        partyA.account.address,
        partyA.account.address,
        1
      )
    );

    await pSymm.write.deposit([collateralToken, collateralAmount, 1], {
      account: partyA.account,
    });
    console.log(
      await custodyRollupId(
        pSymm,
        partyA.account.address,
        partyA.account.address,
        1
      )
    );

    const balance = await pSymm.read.custodyRollupBalances([
      await custodyRollupId(
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

    const updatedBalance = await pSymm.read.custodyRollupBalances([
      await custodyRollupId(
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

  it("should definitely fail", async function () {
    assert.fail("Forced failure");
  });
}

module.exports = {
  shouldDepositAndWithdrawCollateral,
};
