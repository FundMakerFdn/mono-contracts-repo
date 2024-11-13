const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  keccak256,
  toHex,
  parseAbi,
  decodeEventLog,
} = require("viem");
const hre = require("hardhat");
const { MOCK_WETH } = require("./constants");
const { deployFixture } = require("./Settlement.creation");

function shouldStoreSettlementData() {
  it("should store settlement data correctly", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const collateralAmount = parseEther("100");

    await mockSymm.write.approve([etfSettlement.address, collateralAmount], {
      account: partyA.account,
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
        collateralAmount,
        mockSymm.address,
        etfParams,
      ],
      {
        account: partyA.account,
      }
    );

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find the SettlementCreated event specifically
    const settlementCreatedLog = receipt.logs.find((log) => {
      try {
        const decoded = decodeEventLog({
          abi: parseAbi([
            "event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB)",
          ]),
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === "SettlementCreated";
      } catch {
        return false;
      }
    });

    const decodedLog = decodeEventLog({
      abi: parseAbi([
        "event SettlementCreated(bytes32 indexed settlementId, address indexed partyA, address indexed partyB)",
      ]),
      data: settlementCreatedLog.data,
      topics: settlementCreatedLog.topics,
    });

    const settlementId = decodedLog.args.settlementId;

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
    assert.equal(settlement.collateralAmount, collateralAmount);
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
