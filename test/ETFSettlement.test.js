const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  encodeAbiParameters,
  keccak256,
  toHex,
} = require("viem");
const hre = require("hardhat");

const MOCK_WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const MOCK_SETTLE_MAKER = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

describe("ETFSettlement", function () {
  async function deployFixture() {
    const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy MockSymm token
    const mockSymm = await hre.viem.deployContract("MockSymm");

    // Deploy ETFSettlement
    const etfSettlement = await hre.viem.deployContract("ETFSettlement", [
      MOCK_SETTLE_MAKER,
      "ETF Settlement",
      "1.0.0",
    ]);

    // Mint tokens to parties
    await mockSymm.write.mint([partyA.account.address, parseEther("1000")]);
    await mockSymm.write.mint([partyB.account.address, parseEther("1000")]);

    return {
      mockSymm,
      etfSettlement,
      deployer,
      partyA,
      partyB,
      publicClient,
    };
  }

  describe("Settlement Creation", function () {
    it("should create settlement with proper collateral", async function () {
      const { mockSymm, etfSettlement, partyA, partyB, publicClient } =
        await loadFixture(deployFixture);

      const partyACollateral = parseEther("100");
      const partyBCollateral = parseEther("50");

      // Approve collateral transfers
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
        etfToken: MOCK_WETH,
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
      assert.equal(settlement.state, 0); // Open state
    });
  });

  describe("Early Agreement", function () {
    it("should execute early agreement with valid signatures", async function () {
      const { mockSymm, etfSettlement, partyA, partyB } = await loadFixture(
        deployFixture
      );

      const partyACollateral = parseEther("100");
      const partyBCollateral = parseEther("50");

      // Approve collateral transfers
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
        etfToken: MOCK_WETH,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyA.account.address,
      };

      // Create settlement
      const settlementId = await etfSettlement.write.createETFSettlement(
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

      // Get nonce for party A
      const nonce = await etfSettlement.read.getNonce([partyA.account.address]);

      // Prepare early agreement parameters
      const partyAAmount = parseEther("120"); // Example amounts
      const partyBAmount = parseEther("30");

      // Sign agreement by both parties
      const domain = {
        name: "ETF Settlement",
        version: "1.0.0",
        chainId: 31337n,
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

      // Execute early agreement
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

      // Verify settlement state
      const settlement = await etfSettlement.read.getSettlementData([
        settlementId,
      ]);
      assert.equal(settlement.state, 1n); // Settled state
    });
  });

  describe("Move to Next Batch", function () {
    it("should move settlement to next batch", async function () {
      const { mockSymm, etfSettlement, partyA, partyB } = await loadFixture(
        deployFixture
      );

      const partyACollateral = parseEther("100");
      const partyBCollateral = parseEther("50");

      // Approve collateral transfers
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
        etfToken: MOCK_WETH,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyA.account.address,
      };

      // Create settlement
      const settlementId = await etfSettlement.write.createETFSettlement(
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

      // Move to next batch
      await etfSettlement.write.moveToNextBatch([settlementId], {
        account: partyA.account,
      });

      // Verify settlement state and next batch schedule
      const settlement = await etfSettlement.read.getSettlementData([
        settlementId,
      ]);
      const isScheduled = await etfSettlement.read.isScheduledForNextBatch([
        settlementId,
      ]);

      assert.equal(settlement.state, 2n); // nextBatch state
      assert.equal(isScheduled, true);
    });
  });
});
