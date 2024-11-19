const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, getAddress } = require("viem");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, validator1, validator2] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const mockSymm = await hre.viem.deployContract("MockSymm");
  const settleMaker = await hre.viem.deployContract("SettleMaker", [
    mockSymm.address,
    7 * 24 * 60 * 60, // 7 days voting period
  ]);

  // Mint SYMM tokens for validators
  await mockSymm.write.mint([validator1.account.address, parseEther("200000")]); // 200k SYMM
  await mockSymm.write.mint([validator2.account.address, parseEther("200000")]);

  return {
    mockSymm,
    settleMaker,
    deployer,
    validator1,
    validator2,
    publicClient,
  };
}

function shouldManageValidators() {
  it("should register validator with sufficient SYMM", async function () {
    const { mockSymm, settleMaker, validator1 } = await loadFixture(
      deployFixture
    );

    // Approve SYMM tokens
    await mockSymm.write.approve([settleMaker.address, parseEther("100000")], {
      account: validator1.account,
    });

    // Register as validator
    await settleMaker.write.registerValidator({
      account: validator1.account,
    });

    const validatorData = await settleMaker.read.getValidatorData([
      validator1.account.address,
    ]);
    assert.equal(
      validatorData.isWhitelisted,
      true,
      "Validator not whitelisted"
    );

    // Check SYMM balance changes
    const validatorBalance = await mockSymm.read.balanceOf([
      validator1.account.address,
    ]);
    const contractBalance = await mockSymm.read.balanceOf([
      settleMaker.address,
    ]);

    assert.equal(
      validatorBalance,
      parseEther("100000"),
      "Incorrect validator balance after registration"
    );
    assert.equal(
      contractBalance,
      parseEther("100000"),
      "Incorrect contract balance after registration"
    );
  });

  it("should fail to register validator without sufficient SYMM", async function () {
    const { mockSymm, settleMaker, validator1, validator2 } = await loadFixture(
      deployFixture
    );

    // Transfer out SYMM to have insufficient balance
    const transferAmount = parseEther("150000");
    await mockSymm.write.transfer(
      [validator1.account.address, transferAmount],
      {
        account: validator2.account,
      }
    );

    await mockSymm.write.approve([settleMaker.address, parseEther("100000")], {
      account: validator2.account,
    });

    await assert.rejects(
      () =>
        settleMaker.write.registerValidator({
          account: validator2.account,
        }),
      (err) => {
        assert.match(err.message, /Insufficient SYMM balance/);
        return true;
      }
    );
  });

  it("should remove validator and return SYMM", async function () {
    const { mockSymm, settleMaker, validator1 } = await loadFixture(
      deployFixture
    );

    // First register
    await mockSymm.write.approve([settleMaker.address, parseEther("100000")], {
      account: validator1.account,
    });
    await settleMaker.write.registerValidator({
      account: validator1.account,
    });

    // Then remove
    await settleMaker.write.removeValidator({
      account: validator1.account,
    });

    const validatorData = await settleMaker.read.getValidatorData([
      validator1.account.address,
    ]);
    assert.equal(
      validatorData.isWhitelisted,
      false,
      "Validator still whitelisted"
    );

    // Check SYMM returned
    const validatorBalance = await mockSymm.read.balanceOf([
      validator1.account.address,
    ]);
    const contractBalance = await mockSymm.read.balanceOf([
      settleMaker.address,
    ]);

    assert.equal(
      validatorBalance,
      parseEther("200000"),
      "SYMM not returned to validator"
    );
    assert.equal(contractBalance, parseEther("0"), "Contract balance not zero");
  });

  it("should fail to remove validator if not registered", async function () {
    const { settleMaker, validator2 } = await loadFixture(deployFixture);

    await assert.rejects(
      async () => {
        await settleMaker.write.removeValidator({
          account: validator2.account,
        });
      },
      {
        message: /Not validator/,
      }
    );
  });
}

module.exports = {
  shouldManageValidators,
  deployFixture,
};
