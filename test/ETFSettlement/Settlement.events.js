const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  parseAbi,
  decodeEventLog,
  getAddress,
  keccak256,
  toHex,
} = require("viem");
const hre = require("hardhat");
const { deployFixture } = require("./Settlement.creation");

function shouldEmitEvents() {
  it("should emit SettlementCreated event with correct parameters", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB, publicClient } =
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

    const createTxHash = await etfSettlement.write.createETFSettlement(
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

    const createReceipt = await publicClient.waitForTransactionReceipt({
      hash: createTxHash,
    });

    // Find and decode the SettlementCreated event
    const settlementCreatedLog = createReceipt.logs.find((log) => {
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

    assert.equal(
      getAddress(decodedLog.args.partyA),
      getAddress(partyA.account.address),
      "Incorrect partyA in SettlementCreated event"
    );
    assert.equal(
      getAddress(decodedLog.args.partyB),
      getAddress(partyB.account.address),
      "Incorrect partyB in SettlementCreated event"
    );

    return { settlementId: decodedLog.args.settlementId, etfParams };
  });

  it("should emit EarlyAgreementExecuted event with correct parameters", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB, publicClient } =
      await loadFixture(deployFixture);
    debugger;

    // Setup and create settlement first
    await mockWeth.write.mint([etfSettlement.address, parseEther("10")]);
    
    const { settlementId } = await createSettlement(
      mockSymm,
      mockWeth,
      etfSettlement,
      partyA,
      partyB,
      publicClient
    );

    // Setup early agreement parameters
    const nonce = await etfSettlement.read.getNonce([partyA.account.address]);
    const partyAAmount = parseEther("120");
    const partyBAmount = parseEther("30");

    const chainId = await publicClient.getChainId();
    const domain = {
      name: "ETF Settlement",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: etfSettlement.address,
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

    const earlyAgreementTxHash =
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

    const earlyAgreementReceipt = await publicClient.waitForTransactionReceipt({
      hash: earlyAgreementTxHash,
    });
    // Find EarlyAgreementExecuted event, skipping Transfer events
    const earlyAgreementEvent = earlyAgreementReceipt.logs.find((log) => {
      // Skip Transfer events
      if (log.topics[0] === keccak256(toHex("Transfer(address,address,uint256)"))) {
        return false;
      }
      return log.topics[0] === keccak256(toHex("EarlyAgreementExecuted(bytes32)"));
    });

    const earlyAgreementLog = decodeEventLog({
      abi: parseAbi([
        "event EarlyAgreementExecuted(bytes32 indexed settlementId)",
      ]),
      data: earlyAgreementEvent.data,
      topics: earlyAgreementEvent.topics,
    });

    assert.equal(
      earlyAgreementLog.args.settlementId,
      settlementId,
      "Incorrect settlementId in EarlyAgreementExecuted event"
    );
  });

  it("should emit InstantWithdrawExecuted event with correct parameters", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB, publicClient } =
      await loadFixture(deployFixture);

    // Setup and create settlement first
    const { settlementId } = await createSettlement(
      mockSymm,
      mockWeth,
      etfSettlement,
      partyA,
      partyB,
      publicClient
    );

    const nonce = await etfSettlement.read.getNonce([partyA.account.address]);
    const replacedParty = partyA.account.address;
    const instantWithdrawFee = parseEther("1");
    const partyAAmount = parseEther("80");
    const partyBAmount = parseEther("20");

    const chainId = await publicClient.getChainId();
    const domain = {
      name: "ETF Settlement",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: etfSettlement.address,
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

    const instantWithdrawTxHash =
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

    const instantWithdrawReceipt = await publicClient.waitForTransactionReceipt(
      { hash: instantWithdrawTxHash }
    );
    // Find InstantWithdrawExecuted event, skipping Transfer events
    const instantWithdrawEvent = instantWithdrawReceipt.logs.find((log) => {
      // Skip Transfer events
      if (log.topics[0] === keccak256(toHex("Transfer(address,address,uint256)"))) {
        return false;
      }
      return log.topics[0] === keccak256(toHex("InstantWithdrawExecuted(bytes32,address,uint256)"));
    });

    const instantWithdrawLog = decodeEventLog({
      abi: parseAbi([
        "event InstantWithdrawExecuted(bytes32 indexed settlementId, address indexed replacedParty, uint256 fee)",
      ]),
      data: instantWithdrawEvent.data,
      topics: instantWithdrawEvent.topics,
    });

    assert.equal(
      instantWithdrawLog.args.settlementId,
      settlementId,
      "Incorrect settlementId in InstantWithdrawExecuted event"
    );
    assert.equal(
      getAddress(instantWithdrawLog.args.replacedParty),
      getAddress(replacedParty),
      "Incorrect replacedParty in InstantWithdrawExecuted event"
    );
    assert.equal(
      instantWithdrawLog.args.fee,
      instantWithdrawFee,
      "Incorrect fee in InstantWithdrawExecuted event"
    );
  });

  it("should emit MovedToNextBatch event with correct parameters", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB, publicClient } =
      await loadFixture(deployFixture);

    // Setup and create settlement first
    const { settlementId } = await createSettlement(
      mockSymm,
      mockWeth,
      etfSettlement,
      partyA,
      partyB,
      publicClient
    );

    const nextBatchTxHash = await etfSettlement.write.moveToNextBatch(
      [settlementId],
      {
        account: partyA.account,
      }
    );

    const nextBatchReceipt = await publicClient.waitForTransactionReceipt({
      hash: nextBatchTxHash,
    });
    // Find MovedToNextBatch event, skipping Transfer events
    const movedToNextBatchEvent = nextBatchReceipt.logs.find((log) => {
      // Skip Transfer events
      if (
        log.topics[0] === keccak256(toHex("Transfer(address,address,uint256)"))
      ) {
        return false;
      }
      return log.topics[0] === keccak256(toHex("MovedToNextBatch(bytes32)"));
    });

    const movedToNextBatchLog = decodeEventLog({
      abi: parseAbi(["event MovedToNextBatch(bytes32 indexed settlementId)"]),
      data: movedToNextBatchEvent.data,
      topics: movedToNextBatchEvent.topics,
    });

    assert.equal(
      movedToNextBatchLog.args.settlementId,
      settlementId,
      "Incorrect settlementId in MovedToNextBatch event"
    );
  });
}

// Helper function to create a settlement and return the settlementId
async function createSettlement(
  mockSymm,
  mockWeth,
  etfSettlement,
  partyA,
  partyB,
  publicClient
) {
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

  const createTxHash = await etfSettlement.write.createETFSettlement(
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

  const createReceipt = await publicClient.waitForTransactionReceipt({
    hash: createTxHash,
  });
  // Find SettlementCreated event, skipping Transfer events
  const settlementCreatedLog = createReceipt.logs.find((log) => {
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

  return {
    settlementId: decodedLog.args.settlementId,
    etfParams,
  };
}

module.exports = {
  shouldEmitEvents,
};