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
    const mockETF = await hre.viem.deployContract("MockSymm");

    // Deploy SettleMaker (mock for testing)
    const settleMaker = await hre.viem.deployContract("SettleMaker");

    // Deploy ETFSettlement
    const etfSettlement = await hre.viem.deployContract("ETFSettlement", [
      await settleMaker.address,
      "ETFSettlement",
      "1.0.0",
    ]);

    // Setup test amounts
    const partyACollateral = parseEther("1000");
    const partyBCollateral = parseEther("500");
    const etfAmount = parseEther("100");

    // Mint tokens to parties
    await mockCollateral.write.mint([partyA.account.address, partyACollateral]);
    await mockCollateral.write.mint([partyB.account.address, partyBCollateral]);
    await mockETF.write.mint([partyA.account.address, etfAmount]);

    // Approve settlement contract
    const publicClient = await hre.viem.getPublicClient();
    await mockCollateral.write.approve(
      [await etfSettlement.address, partyACollateral],
      {
        account: partyA.account,
      }
    );
    await mockCollateral.write.approve(
      [await etfSettlement.address, partyBCollateral],
      {
        account: partyB.account,
      }
    );
    await mockETF.write.approve([await etfSettlement.address, etfAmount], {
      account: partyA.account,
    });

    return {
      etfSettlement,
      mockCollateral,
      mockETF,
      settleMaker,
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

      const params = {
        priceMint: parseEther("10"),
        mintTime: Math.floor(Date.now() / 1000),
        etfTokenAmount: etfAmount,
        etfToken: await mockETF.address,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyB.account.address,
      };

      const tx = await etfSettlement.write.createETFSettlement(
        [
          partyA.account.address,
          partyB.account.address,
          partyACollateral,
          partyBCollateral,
          await mockCollateral.address,
          params,
        ],
        { account: partyA.account }
      );

      const receipt = await tx.wait();
      const settlementId = receipt.logs[0].args.settlementId;

      // Verify settlement data
      const settlement = await etfSettlement.read.getSettlementData([
        settlementId,
      ]);
      assert.equal(settlement.partyA, partyA.account.address);
      assert.equal(settlement.partyB, partyB.account.address);
      assert.equal(settlement.partyACollateral, partyACollateral);
      assert.equal(settlement.partyBCollateral, partyBCollateral);
      assert.equal(settlement.collateralToken, await mockCollateral.address);
      assert.equal(settlement.state, 0); // Open state

      // Verify ETF parameters
      const etfParams = await etfSettlement.read.getETFParameters([
        settlementId,
      ]);
      assert.equal(etfParams.priceMint, params.priceMint);
      assert.equal(etfParams.etfTokenAmount, params.etfTokenAmount);
      assert.equal(etfParams.etfToken, params.etfToken);

      // Verify token transfers
      assert.equal(
        await mockETF.read.balanceOf([await etfSettlement.address]),
        etfAmount
      );
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
        etfToken: await mockETF.address,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyB.account.address,
      };

      const tx = await etfSettlement.write.createETFSettlement(
        [
          partyA.account.address,
          partyB.account.address,
          partyACollateral,
          partyBCollateral,
          await mockCollateral.address,
          params,
        ],
        { account: partyA.account }
      );

      const receipt = await tx.wait();
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
      assert.equal(
        await mockETF.read.balanceOf([partyA.account.address]),
        etfAmount
      );

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
        etfToken: await mockETF.address,
        interestRate: parseEther("0.05"),
        interestRatePayer: partyB.account.address,
      };

      // Create settlement
      const tx = await etfSettlement.write.createETFSettlement(
        [
          partyA.account.address,
          partyB.account.address,
          partyACollateral,
          partyBCollateral,
          await mockCollateral.address,
          params,
        ],
        { account: partyA.account }
      );

      const receipt = await tx.wait();
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
