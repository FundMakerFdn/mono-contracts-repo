const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, keccak256, toHex } = require("viem");
const hre = require("hardhat");
const { deployFixture } = require("./Settlement.creation");

function shouldExecuteInstantWithdraw() {
  it("should execute instant withdraw with valid signature", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const partyACollateral = parseEther("100");
    const partyBCollateral = parseEther("50");

    await mockSymm.write.approve([etfSettlement.address, partyACollateral], {
      account: partyA.account,
    });
    await mockSymm.write.approve([etfSettlement.address, partyBCollateral], {
      account: partyB.account,
    });

    const etfParams = {
      priceMint: parseEther("1000"),
      mintTime: BigInt(Math.floor(Date.now() / 1000)),
      etfTokenAmount: parseEther("10"),
      etfToken: mockWeth.address,
      interestRate: parseEther("0.05"),
      interestRatePayer: partyA.account.address,
    };

    const hash = await etfSettlement.write.createETFSettlement(
      [
        partyA.account.address,
        partyB.account.address,
        partyACollateral,
        partyBCollateral,
        mockSymm.address,
        etfParams,
      ],
      {
        account: partyA.account,
      }
    );

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const SETTLEMENT_CREATED_EVENT = keccak256(
      toHex("SettlementCreated(bytes32,address,address)")
    );
    const settlementCreatedEvent = receipt.logs.find(
      (log) => log.topics[0] === SETTLEMENT_CREATED_EVENT
    );
    const settlementId = settlementCreatedEvent.topics[1];

    const chainId = await publicClient.getChainId();
    const contractAddress = await etfSettlement.address;

    const domain = {
      name: "ETF Settlement",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      InstantWithdraw: [
        { name: "settlementId", type: "bytes32" },
        { name: "replacedParty", type: "address" },
        { name: "instantWithdrawFee", type: "uint256" },
        { name: "partyAAmount", type: "uint256" },
        { name: "partyBAmount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const nonce = await etfSettlement.read.getNonce([partyA.account.address]);
    const replacedParty = partyA.account.address;
    const instantWithdrawFee = parseEther("1");
    const partyAAmount = parseEther("80");
    const partyBAmount = parseEther("20");

    const message = {
      settlementId,
      replacedParty,
      instantWithdrawFee,
      partyAAmount,
      partyBAmount,
      nonce,
    };

    const signature = await partyA.signTypedData({
      domain,
      types,
      primaryType: "InstantWithdraw",
      message,
    });

    const initialPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const initialPartyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);
    const initialSolverBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);

    await etfSettlement.write.executeInstantWithdraw(
      [
        settlementId,
        replacedParty,
        instantWithdrawFee,
        partyAAmount,
        partyBAmount,
        signature,
      ],
      {
        account: partyB.account,
      }
    );

    const finalPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const finalPartyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);
    const finalSolverBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);

    const settlement = await etfSettlement.read.getSettlementData([
      settlementId,
    ]);

    assert.equal(settlement.state, 1); // Settled state
    assert.equal(finalPartyABalance, initialPartyABalance + partyAAmount);
    assert.equal(
      finalPartyBBalance,
      initialPartyBBalance + partyBAmount + instantWithdrawFee
    );
  });

  it("should fail instant withdraw with invalid signature", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const partyACollateral = parseEther("100");
    const partyBCollateral = parseEther("50");

    await mockSymm.write.approve([etfSettlement.address, partyACollateral], {
      account: partyA.account,
    });
    await mockSymm.write.approve([etfSettlement.address, partyBCollateral], {
      account: partyB.account,
    });

    const etfParams = {
      priceMint: parseEther("1000"),
      mintTime: BigInt(Math.floor(Date.now() / 1000)),
      etfTokenAmount: parseEther("10"),
      etfToken: mockWeth.address,
      interestRate: parseEther("0.05"),
      interestRatePayer: partyA.account.address,
    };

    const hash = await etfSettlement.write.createETFSettlement(
      [
        partyA.account.address,
        partyB.account.address,
        partyACollateral,
        partyBCollateral,
        mockSymm.address,
        etfParams,
      ],
      {
        account: partyA.account,
      }
    );

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const SETTLEMENT_CREATED_EVENT = keccak256(
      toHex("SettlementCreated(bytes32,address,address)")
    );
    const settlementCreatedEvent = receipt.logs.find(
      (log) => log.topics[0] === SETTLEMENT_CREATED_EVENT
    );
    const settlementId = settlementCreatedEvent.topics[1];

    const chainId = await publicClient.getChainId();
    const contractAddress = await etfSettlement.address;

    const domain = {
      name: "ETF Settlement",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      InstantWithdraw: [
        { name: "settlementId", type: "bytes32" },
        { name: "replacedParty", type: "address" },
        { name: "instantWithdrawFee", type: "uint256" },
        { name: "partyAAmount", type: "uint256" },
        { name: "partyBAmount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const nonce = await etfSettlement.read.getNonce([partyA.account.address]);
    const replacedParty = partyA.account.address;
    const instantWithdrawFee = parseEther("1");
    const partyAAmount = parseEther("80");
    const partyBAmount = parseEther("20");

    const message = {
      settlementId,
      replacedParty,
      instantWithdrawFee,
      partyAAmount,
      partyBAmount,
      nonce,
    };

    // Intentionally sign with partyB instead of partyA to create an invalid signature
    const signature = await partyB.signTypedData({
      domain,
      types,
      primaryType: "InstantWithdraw",
      message,
    });

    await assert.rejects(
      async () => {
        await etfSettlement.write.executeInstantWithdraw(
          [
            settlementId,
            replacedParty,
            instantWithdrawFee,
            partyAAmount,
            partyBAmount,
            signature,
          ],
          {
            account: partyB.account,
          }
        );
      },
      {
        message: /Invalid signature/,
      }
    );
  });
}

module.exports = {
  shouldExecuteInstantWithdraw,
};
