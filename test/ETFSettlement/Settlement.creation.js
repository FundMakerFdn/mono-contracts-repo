const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { parseEther, getAddress, keccak256, toHex } = require("viem");
const hre = require("hardhat");

const { MOCK_SETTLE_MAKER } = require("./constants");

async function deployFixture() {
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const mockSymm = await hre.viem.deployContract("MockSymm");
  const mockWeth = await hre.viem.deployContract("MockToken", [
    "Mock Wrapped Ether",
    "WETH",
  ]);
  const etfSettlement = await hre.viem.deployContract("ETFSettlement", [
    MOCK_SETTLE_MAKER,
    "ETF Settlement",
    "1.0.0",
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
    assert.equal(settlement.state, 0);

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
    assert.equal(partyBBalance, parseEther("950"));
    assert.equal(contractBalance, parseEther("150"));
  });

  it("should fail to create settlement without approval", async function () {
    const { mockWeth, mockSymm, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const partyACollateral = parseEther("100");
    const partyBCollateral = parseEther("50");

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
            partyACollateral,
            partyBCollateral,
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

    const partyACollateral = parseEther("2000"); // More than minted amount
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

    await assert.rejects(
      async () => {
        await etfSettlement.write.createETFSettlement(
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
      },
      {
        message: /ERC20InsufficientBalance/,
      }
    );
  });

  it("should verify balances decrease by collateral amount after settlement creation", async function () {
    const { mockWeth, mockSymm, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const partyACollateral = parseEther("100");
    const partyBCollateral = parseEther("50");

    const initialPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const initialPartyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);
    const initialContractBalance = await mockSymm.read.balanceOf([
      etfSettlement.address,
    ]);

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

    await etfSettlement.write.createETFSettlement(
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

    const finalPartyABalance = await mockSymm.read.balanceOf([
      partyA.account.address,
    ]);
    const finalPartyBBalance = await mockSymm.read.balanceOf([
      partyB.account.address,
    ]);
    const finalContractBalance = await mockSymm.read.balanceOf([
      etfSettlement.address,
    ]);

    assert.equal(finalPartyABalance, initialPartyABalance - partyACollateral);
    assert.equal(finalPartyBBalance, initialPartyBBalance - partyBCollateral);
    assert.equal(
      finalContractBalance,
      initialContractBalance + partyACollateral + partyBCollateral
    );
  });
}

module.exports = {
  shouldCreateSettlement,
  deployFixture,
};
