const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  keccak256,
  toHex,
  decodeEventLog,
  parseAbi,
} = require("viem");
const hre = require("hardhat");
const { deployFixture } = require("./Settlement.creation");

function shouldExecuteEarlyAgreement() {
  it("should execute early agreement with valid signatures", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const collateralAmount = parseEther("100");

    // Verify initial state
    const initialPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const initialPartyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);

    await mockSymm.write.approve([etfSettlement.address, collateralAmount], {
      account: partyA.account,
    });

    // Mint exact amount needed for distribution
    const partyAAmount = parseEther("70");
    const partyBAmount = parseEther("30");
    assert.equal(
      partyAAmount + partyBAmount,
      collateralAmount,
      "Distribution must match collateral"
    );

    await mockSymm.write.mint([etfSettlement.address, collateralAmount]);

    const etfParams = {
      priceMint: parseEther("10"),
      mintTime: BigInt(Math.floor(Date.now() / 1000)),
      etfTokenAmount: parseEther("10"),
      etfToken: mockWeth.address,
      interestRate: parseEther("0.05"),
      interestRatePayer: partyA.account.address,
    };

    // Mint ETF tokens to settlement contract
    await mockWeth.write.mint([
      etfSettlement.address,
      etfParams.etfTokenAmount,
    ]);

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
      version: "1.0",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      EarlyAgreement: [
        { name: "settlementId", type: "bytes32" },
        { name: "partyAAmount", type: "uint256" },
        { name: "partyBAmount", type: "uint256" },
      ],
    };

    const message = {
      settlementId,
      partyAAmount,
      partyBAmount,
    };

    // Get signature from party B since msg.sender will be party A
    const signature = await partyB.signTypedData({
      domain,
      types,
      primaryType: "EarlyAgreement",
      message,
    });

    const earlyAgreementReceipt = await publicClient.waitForTransactionReceipt({
      hash: await etfSettlement.write.executeEarlyAgreement(
        [settlementId, partyAAmount, partyBAmount, signature],
        {
          account: partyA.account,
        }
      ),
    });

    // Find and decode the EarlyAgreementExecuted event
    const earlyAgreementLog = earlyAgreementReceipt.logs.find((log) => {
      try {
        const decoded = decodeEventLog({
          abi: etfSettlement.abi,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === "EarlyAgreementExecuted";
      } catch {
        return false;
      }
    });

    const decodedLog = decodeEventLog({
      abi: parseAbi([
        "event EarlyAgreementExecuted(bytes32 indexed settlementId)",
      ]),
      data: earlyAgreementLog.data,
      topics: earlyAgreementLog.topics,
    });

    assert.equal(
      decodedLog.args.settlementId,
      settlementId,
      "Incorrect settlementId in EarlyAgreementExecuted event"
    );

    const settlement = await etfSettlement.read.getSettlementData([
      settlementId,
    ]);
    assert.equal(settlement.state, 1);
  });
}

module.exports = {
  shouldExecuteEarlyAgreement,
};
