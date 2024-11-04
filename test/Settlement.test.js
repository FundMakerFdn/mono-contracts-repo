const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, encodeAbiParameters, getAddress } = require("viem");
const hre = require("hardhat");

describe("Settlement", function () {
  async function deployFixture() {
    const [owner, partyA, partyB] = await hre.viem.getWalletClients();

    // Deploy MockSymm for collateral
    const mockSymm = await hre.viem.deployContract("MockSymm");

    // Deploy Settlement implementation
    const settlement = await hre.viem.deployContract("Settlement", [
      owner.account.address, // SettleMaker address
    ]);

    // Mint tokens to parties
    await mockSymm.write.mint([partyA.account.address, parseEther("1000")]);

    await mockSymm.write.mint([partyB.account.address, parseEther("1000")]);

    return {
      settlement,
      mockSymm,
      owner,
      partyA,
      partyB,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct SettleMaker address", async function () {
      const { settlement, owner } = await loadFixture(deployFixture);
      assert.equal(
        getAddress(await settlement.read.getSettleMaker()),
        getAddress(owner.account.address)
      );
    });
  });

  describe("Settlement Creation", function () {
    it("Should create settlement with correct parameters", async function () {
      const { settlement, mockSymm, partyA, partyB } = await loadFixture(
        deployFixture
      );

      const partyACollateral = parseEther("100");
      const partyBCollateral = parseEther("200");

      await settlement.write.createSettlement([
        partyA.account.address,
        partyB.account.address,
        partyACollateral,
        partyBCollateral,
        mockSymm.address,
      ]);

      const events = await settlement.getEvents.SettlementCreated();
      assert.ok(events.length > 0, "SettlementCreated event should be emitted");

      // Get settlement data using the emitted settlementId
      const settlementId = events[0].args.settlementId;
      const settlementData = await settlement.read.getSettlementData([
        settlementId,
      ]);

      assert.equal(
        getAddress(settlementData.partyA),
        getAddress(partyA.account.address)
      );
      assert.equal(
        getAddress(settlementData.partyB),
        getAddress(partyB.account.address)
      );
      assert.equal(settlementData.partyACollateral, partyACollateral);
      assert.equal(settlementData.partyBCollateral, partyBCollateral);
      assert.equal(
        getAddress(settlementData.collateralToken),
        getAddress(mockSymm.address)
      );
      assert.equal(settlementData.state, 0); // Open state
    });

    it("Should emit CollateralLocked event", async function () {
      const { settlement, mockSymm, partyA, partyB } = await loadFixture(
        deployFixture
      );

      await settlement.write.createSettlement([
        partyA.account.address,
        partyB.account.address,
        parseEther("100"),
        parseEther("200"),
        mockSymm.address,
      ]);

      const events = await settlement.getEvents.CollateralLocked();
      assert.ok(events.length > 0, "CollateralLocked event should be emitted");
    });
  });

  describe("Settlement Management", function () {
    it("Should move settlement to next batch", async function () {
      const { settlement, mockSymm, partyA, partyB } = await loadFixture(
        deployFixture
      );

      // Create settlement first
      await settlement.write.createSettlement([
        partyA.account.address,
        partyB.account.address,
        parseEther("100"),
        parseEther("200"),
        mockSymm.address,
      ]);

      const createEvents = await settlement.getEvents.SettlementCreated();
      const settlementId = createEvents[0].args.settlementId;

      // Move to next batch
      await settlement.write.moveToNextBatch([settlementId]);

      const moveEvents = await settlement.getEvents.SettlementMovedToNextBatch();
      assert.ok(
        moveEvents.length > 0,
        "SettlementMovedToNextBatch event should be emitted"
      );

      // Verify settlement is scheduled for next batch
      const isScheduled = await settlement.read.isScheduledForNextBatch([
        settlementId,
      ]);
      assert.ok(isScheduled, "Settlement should be scheduled for next batch");
    });
  });
});
