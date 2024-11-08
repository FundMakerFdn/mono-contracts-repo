const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, keccak256, toHex } = require("viem");
const hre = require("hardhat");
const { deployFixture } = require("./Settlement.creation");

function shouldExecuteEarlyAgreement() {
  it("should execute early agreement with valid signatures", async function () {
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
      etfToken: mockWeth.address, // Use deployed mockWeth
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

    const nonce = await etfSettlement.read.getNonce([partyA.account.address]);
    const partyAAmount = parseEther("120");
    const partyBAmount = parseEther("30");

    const chainId = await publicClient.getChainId();
    const contractAddress = await etfSettlement.address;

    const domain = {
      name: "ETF Settlement",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      EarlyAgreement: [
        { name: "settlementId", type: "bytes32" },
        { name: "partyAAmount", type: "uint256" },
        { name: "partyBAmount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const message = {
      settlementId,
      partyAAmount,
      partyBAmount,
      nonce,
    };

    const partyASignature = await partyA.signTypedData({
      domain,
      types,
      primaryType: "EarlyAgreement",
      message,
    });

    const partyBSignature = await partyB.signTypedData({
      domain,
      types,
      primaryType: "EarlyAgreement",
      message,
    });

    await etfSettlement.write.executeEarlyAgreement(
      [
        settlementId,
        partyAAmount,
        partyBAmount,
        partyASignature,
        partyBSignature,
      ],
      {
        account: partyA.account,
      }
    );

    const settlement = await etfSettlement.read.getSettlementData([
      settlementId,
    ]);
    assert.equal(settlement.state, 1n);
  });
}

module.exports = {
  shouldExecuteEarlyAgreement,
};
