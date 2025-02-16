const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  keccak256,
  toHex,
  decodeEventLog,
} = require("viem");
const hre = require("hardhat");

async function deployFixture() {
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const mockSymm = await hre.viem.deployContract("MockSymm");
  const mockWeth = await hre.viem.deployContract("MockToken", [
    "Mock Wrapped Ether",
    "WETH",
  ]);
  const etfSettlement = await hre.viem.deployContract("ETFSettlement", [
    mockSymm.address,
    "ETF Settlement",
    "1.0",
  ]);

  await mockSymm.write.mint([partyA.account.address, parseEther("1000")]);
  await mockSymm.write.mint([partyB.account.address, parseEther("1000")]);

  // Also mint some WETH for testing
  await mockWeth.write.mint([partyA.account.address, parseEther("1000")]);
  await mockWeth.write.mint([partyB.account.address, parseEther("1000")]);

  return {
    mockSymm,
    mockWeth,
    etfSettlement,
    deployer,
    partyA,
    partyB,
    publicClient,
  };
}

function shouldCreateSettlement() {
  it("should create settlement with proper collateral", async function () {
    const { mockWeth, mockSymm, etfSettlement, partyA, partyB, publicClient } =
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

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const SETTLEMENT_CREATED_EVENT = keccak256(
      toHex("SettlementCreated(bytes32,address,address)")
    );
    const settlementCreatedEvent = receipt.logs.find(
      (log) => log.topics[0] === SETTLEMENT_CREATED_EVENT
    );
    const decodedLog = decodeEventLog({
      abi: etfSettlement.abi,
      eventName: "SettlementCreated",
      topics: settlementCreatedEvent.topics,
      data: settlementCreatedEvent.data,
    });

    const settlementId = decodedLog.args.settlementId;

    assert.equal(
      getAddress(decodedLog.args.partyA),
      getAddress(partyA.account.address),
      "Incorrect partyA in event"
    );
    assert.equal(
      getAddress(decodedLog.args.partyB),
      getAddress(partyB.account.address),
      "Incorrect partyB in event"
    );

    const settlement = await etfSettlement.read.getSettlementData([
      settlementId,
    ]);

    // Verify settlement ID format
    assert.match(
      settlementId.toString(),
      /^0x[a-fA-F0-9]{64}$/,
      "Invalid settlement ID format"
    );

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
    assert.equal(settlement.state, 0);

    // Verify ETF parameters
    const etfSettlementParams = await etfSettlement.read.getETFParameters([
      settlementId,
    ]);
    assert.equal(
      etfSettlementParams.priceMint,
      etfParams.priceMint,
      "Incorrect priceMint"
    );
    assert.equal(
      etfSettlementParams.mintTime,
      etfParams.mintTime,
      "Incorrect mint time"
    );
    assert.equal(
      etfSettlementParams.etfTokenAmount,
      etfParams.etfTokenAmount,
      "Incorrect ETF token amount"
    );
    assert.equal(
      getAddress(etfSettlementParams.etfToken),
      getAddress(etfParams.etfToken),
      "Incorrect ETF token"
    );
    assert.equal(
      etfSettlementParams.interestRate,
      etfParams.interestRate,
      "Incorrect interest rate"
    );
    assert.equal(
      getAddress(etfSettlementParams.interestRatePayer),
      getAddress(etfParams.interestRatePayer),
      "Incorrect interest rate payer"
    );

    const partyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const partyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);
    const contractBalance = await mockSymm.read.balanceOf([
      etfSettlement.address,
    ]);

    assert.equal(partyABalance, parseEther("900"));
    assert.equal(partyBBalance, parseEther("1000"));
    assert.equal(contractBalance, parseEther("100"));
  });

  it("should fail to create settlement without approval", async function () {
    const { mockWeth, mockSymm, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const collateralAmount = parseEther("100");

    const etfParams = {
      priceMint: parseEther("1000"),
      mintTime: BigInt(Math.floor(Date.now() / 1000)),
      etfTokenAmount: parseEther("10"),
      etfToken: mockWeth.address,
      interestRate: parseEther("0.05"),
      interestRatePayer: partyA.account.address,
    };

    await assert.rejects(
      async () => {
        await etfSettlement.write.createETFSettlement(
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
      },
      {
        message: /ERC20InsufficientAllowance/,
      }
    );
  });

  it("should fail to create settlement with insufficient balance", async function () {
    const { mockWeth, mockSymm, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const collateralAmount = parseEther("2000"); // More than minted amount

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

    await assert.rejects(
      async () => {
        await etfSettlement.write.createETFSettlement(
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
      },
      {
        message: /ERC20InsufficientBalance/,
      }
    );
  });

  it("should verify balances decrease by collateral amount after settlement creation", async function () {
    const { mockWeth, mockSymm, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const collateralAmount = parseEther("100");

    const initialPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const initialContractBalance = await mockSymm.read.balanceOf([
      etfSettlement.address,
    ]);

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

    await etfSettlement.write.createETFSettlement(
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

    const finalPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const finalPartyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);
    const finalContractBalance = await mockSymm.read.balanceOf([
      etfSettlement.address,
    ]);

    assert.equal(finalPartyABalance, initialPartyABalance - collateralAmount);
    assert.equal(
      finalContractBalance,
      initialContractBalance + collateralAmount
    );
  });
}

module.exports = {
  shouldCreateSettlement,
  deployFixture,
};
