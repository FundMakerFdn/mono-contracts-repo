const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, getAddress, keccak256, toHex } = require("viem");
const hre = require("hardhat");
const { MOCK_WETH } = require("./constants");
const { deployFixture } = require("./Settlement.creation");

function shouldStoreSettlementData() {
  it("should store settlement data correctly", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } = await loadFixture(
      deployFixture
    );

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

    const settlement = await etfSettlement.read.getSettlementData([
      settlementId,
    ]);

    // Check basic settlement data
    assert.equal(
      getAddress(settlement.partyA),
      getAddress(partyA.account.address)
    );
    assert.equal(
      getAddress(settlement.partyB),
      getAddress(partyB.account.address)
    );
    assert.equal(settlement.partyACollateral, partyACollateral);
    assert.equal(settlement.partyBCollateral, partyBCollateral);
    assert.equal(
      getAddress(settlement.collateralToken),
      getAddress(mockSymm.address)
    );
    assert.equal(settlement.state, 0); // Should be in OPEN state

    // Get ETF specific parameters
    const etfSettlementParams = await etfSettlement.read.getETFParameters([
      settlementId,
    ]);

    // Check ETF specific data
    assert.equal(etfSettlementParams.priceMint, etfParams.priceMint);
    assert.equal(etfSettlementParams.mintTime, etfParams.mintTime);
    assert.equal(etfSettlementParams.etfTokenAmount, etfParams.etfTokenAmount);
    assert.equal(
      getAddress(etfSettlementParams.etfToken),
      getAddress(etfParams.etfToken)
    );
    assert.equal(etfSettlementParams.interestRate, etfParams.interestRate);
    assert.equal(
      getAddress(etfSettlementParams.interestRatePayer),
      getAddress(etfParams.interestRatePayer)
    );
  });
}

module.exports = {
  shouldStoreSettlementData,
};
