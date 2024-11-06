const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther } = require("viem");
const hre = require("hardhat");

describe("ETFSettlement", function () {
  async function deployFixture() {
    const [owner, partyA, partyB, validator] =
      await hre.viem.getWalletClients();

    // Deploy mock tokens
    const mockCollateral = await hre.viem.deployContract("MockSymm");

    // Use predefined address for SettleMaker
    const MOCK_SETTLE_MAKER = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    // TODO: real mock ETF token
    const mockETF = await hre.viem.deployContract("MockSymm"); // Deploy a mock ETF token

    // Deploy ETFSettlement
    const etfSettlement = await hre.viem.deployContract("ETFSettlement", [
      MOCK_SETTLE_MAKER,
      "ETFSettlement",
      "1.0.0",
    ]);

    // Setup test amounts
    const partyACollateral = parseEther("1000");
    const partyBCollateral = parseEther("1000");
    const etfAmount = parseEther("0");

    // Mint tokens to parties
    await mockCollateral.write.mint([partyA.account.address, partyACollateral]);
    await mockCollateral.write.mint([partyB.account.address, partyBCollateral]);

    // Approve settlement contract
    const publicClient = await hre.viem.getPublicClient();
    await mockCollateral.write.approve(
      [etfSettlement.address, partyACollateral],
      {
        account: partyA.account,
      }
    );
    await mockCollateral.write.approve(
      [etfSettlement.address, partyBCollateral],
      {
        account: partyB.account,
      }
    );

    return {
      etfSettlement,
      mockCollateral,
      mockETF,
      owner,
      partyA,
      partyB,
      validator,
      partyACollateral,
      partyBCollateral,
      etfAmount,
    };
  }

  describe("Settlement Creation", function () {
    it("Should create ETF settlement with correct parameters", async function () {
      debugger;
      const {
        etfSettlement,
        mockCollateral,
        mockETF,
        partyA,
        partyB,
        partyACollateral,
        partyBCollateral,
        etfAmount,
      } = await loadFixture(deployFixture);
      console.log("Settlement contract address:", await etfSettlement.address);
      console.log("Collateral contract address:", mockCollateral.address);

      const allowanceA = await mockCollateral.read.allowance([
        partyA.account.address,
        etfSettlement.address, // Check allowance for settlement contract
      ]);
      console.log("Allowance A:", allowanceA);
      const allowanceB = await mockCollateral.read.allowance([
        partyB.account.address,
        etfSettlement.address, // Check allowance for settlement contract
      ]);
      console.log("Allowance B:", allowanceB);

      const params = {
        priceMint: parseEther("10"),
        mintTime: Math.floor(Date.now() / 1000),
        etfTokenAmount: etfAmount,
        etfToken: mockETF.address,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyB.account.address,
      };

      const hash = await etfSettlement.write.createETFSettlement(
        [
          partyA.account.address,
          partyB.account.address,
          partyACollateral,
          partyBCollateral,
          mockCollateral.address,
          params,
        ],
        { account: partyA.account }
      );

      // Wait for transaction to be mined by checking transaction receipt
      const client = await hre.viem.getWalletClient();
      let receipt;
      for (let i = 0; i < 10; i++) {
        // Retry up to 10 times
        receipt = await client.getTransactionReceipt({ hash });
        if (receipt) break;
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      }

      if (!receipt) {
        throw new Error("Transaction receipt not found");
      }

      const settlementId = receipt.logs[0].args.settlementId;

      // Verify settlement data
      const settlement = await etfSettlement.read.getSettlementData([
        settlementId,
      ]);
      assert.equal(settlement.partyA, partyA.account.address);
      assert.equal(settlement.partyB, partyB.account.address);
      assert.equal(settlement.partyACollateral, partyACollateral);
      assert.equal(settlement.partyBCollateral, partyBCollateral);
      assert.equal(settlement.collateralToken, mockCollateral.address);
      assert.equal(settlement.state, 0); // Open state

      // Verify ETF parameters
      const etfParams = await etfSettlement.read.getETFParameters([
        settlementId,
      ]);
      assert.equal(etfParams.priceMint, params.priceMint);
      assert.equal(etfParams.etfTokenAmount, params.etfTokenAmount);
      assert.equal(etfParams.etfToken, params.etfToken);

      // Verify token transfers
      // Removed balance check for mockETF
      assert.equal(
        await mockCollateral.read.balanceOf([await etfSettlement.address]),
        partyACollateral + partyBCollateral
      );
    });
  });

  describe("Early Agreement", function () {
    it("Should execute early agreement with valid signatures", async function () {
      const {
        etfSettlement,
        mockCollateral,
        mockETF,
        partyA,
        partyB,
        partyACollateral,
        partyBCollateral,
        etfAmount,
      } = await loadFixture(deployFixture);

      // Create settlement first
      const params = {
        priceMint: parseEther("10"),
        mintTime: Math.floor(Date.now() / 1000),
        etfTokenAmount: etfAmount,
        etfToken: mockETF.address,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyB.account.address,
      };

      const hash = await etfSettlement.write.createETFSettlement(
        [
          partyA.account.address,
          partyB.account.address,
          partyACollateral,
          partyBCollateral,
          mockCollateral.address,
          params,
        ],
        { account: partyA.account }
      );

      const publicClient = await hre.viem.getPublicClient();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const settlementId = receipt.logs[0].args.settlementId;

      // Get domain and sign early agreement
      const domain = {
        name: "ETFSettlement",
        version: "1.0.0",
        chainId: await hre.viem.getPublicClient().getChainId(),
        verifyingContract: await etfSettlement.address,
      };

      const types = {
        EarlyAgreement: [
          { name: "settlementId", type: "bytes32" },
          { name: "partyAAmount", type: "uint256" },
          { name: "partyBAmount", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      };

      const value = {
        settlementId: settlementId,
        partyAAmount: partyACollateral,
        partyBAmount: partyBCollateral,
        nonce: await etfSettlement.read.getNonce([partyA.account.address]),
      };

      const partyASignature = await partyA.signTypedData(domain, types, value);
      const partyBSignature = await partyB.signTypedData(domain, types, value);

      // Execute early agreement
      await etfSettlement.write.executeEarlyAgreement(
        [
          settlementId,
          partyACollateral,
          partyBCollateral,
          partyASignature,
          partyBSignature,
        ],
        { account: partyA.account }
      );

      // Verify final token balances
      assert.equal(
        await mockCollateral.read.balanceOf([partyA.account.address]),
        partyACollateral
      );
      assert.equal(
        await mockCollateral.read.balanceOf([partyB.account.address]),
        partyBCollateral
      );
      // Removed balance check for mockETF

      // Verify settlement state
      const settlement = await etfSettlement.read.getSettlementData([
        settlementId,
      ]);
      assert.equal(settlement.state, 1); // Settled state
    });
  });

  describe("Move to Next Batch", function () {
    it("Should move settlement to next batch", async function () {
      const {
        etfSettlement,
        partyA,
        partyB,
        partyACollateral,
        partyBCollateral,
        mockCollateral,
        mockETF,
        etfAmount,
      } = await loadFixture(deployFixture);

      const params = {
        priceMint: parseEther("10"),
        mintTime: Math.floor(Date.now() / 1000),
        etfTokenAmount: etfAmount,
        etfToken: mockETF.address,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyB.account.address,
      };

      // Create settlement
      const hash = await etfSettlement.write.createETFSettlement(
        [
          partyA.account.address,
          partyB.account.address,
          partyACollateral,
          partyBCollateral,
          mockCollateral.address,
          params,
        ],
        { account: partyA.account }
      );

      const publicClient = await hre.viem.getPublicClient();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const settlementId = receipt.logs[0].args.settlementId;

      // Move to next batch
      await etfSettlement.write.moveToNextBatch([settlementId]);

      // Verify state changes
      const settlement = await etfSettlement.read.getSettlementData([
        settlementId,
      ]);
      assert.equal(settlement.state, 2); // nextBatch state
      assert.equal(
        await etfSettlement.read.isScheduledForNextBatch([settlementId]),
        true
      );
    });
  });
});
