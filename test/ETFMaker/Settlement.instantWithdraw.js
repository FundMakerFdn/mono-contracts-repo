const assert = require("node:assert/strict");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  keccak256,
  toHex,
  getAddress,
  decodeEventLog,
  parseAbi,
} = require("viem");
const hre = require("hardhat");
const { deployFixture } = require("./Settlement.creation");

function shouldExecuteInstantWithdraw() {
  it("should execute instant withdraw with valid signature", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } =
      await loadFixture(deployFixture);

    const partyACollateral = parseEther("100");
    const partyBCollateral = parseEther("50");

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

    const replacedParty = partyA.account.address;
    const instantWithdrawFee = parseEther("1");
    const partyAAmount = parseEther("80");
    const partyBAmount = parseEther("20");

    // PartyA wants to exit early and requests quotes with these amounts
    const requestedPartyAAmount = partyAAmount; // Amount PartyA wants to receive
    const requestedPartyBAmount = partyBAmount; // Remaining amount after PartyA exit
    
    // PartyB (acting as solver) offers quote with their fee
    const solverFee = instantWithdrawFee;
    const totalNeeded = requestedPartyAAmount + requestedPartyBAmount + solverFee;

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

    // Mint tokens to the contract to cover the withdrawals and fee
    const totalAmount = partyAAmount + partyBAmount + instantWithdrawFee;
    await mockSymm.write.mint([etfSettlement.address, totalAmount]);

    const publicClient = await hre.viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const SETTLEMENT_CREATED_EVENT = keccak256(
      toHex("SettlementCreated(bytes32,address,address)")
    );
    // Filter out Transfer events and find SettlementCreated
    const settlementCreatedEvent = receipt.logs.find((log) => {
      // Skip Transfer events
      if (
        log.topics[0] === keccak256(toHex("Transfer(address,address,uint256)"))
      ) {
        return false;
      }
      return log.topics[0] === SETTLEMENT_CREATED_EVENT;
    });
    const settlementId = settlementCreatedEvent.topics[1];

    const chainId = await publicClient.getChainId();
    const contractAddress = await etfSettlement.address;

    const domain = {
      name: "ETF Settlement",
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      InstantWithdraw: [
        { name: "settlementId", type: "bytes32" },
        { name: "replacedParty", type: "address" },
        { name: "instantWithdrawFee", type: "uint256" },
        { name: "partyAAmount", type: "uint256" },
        { name: "partyBAmount", type: "uint256" },
      ],
    };

    const message = {
      settlementId,
      replacedParty,
      instantWithdrawFee,
      partyAAmount,
      partyBAmount,
    };

    // First PartyA verifies the solver's quote matches their request
    assert.equal(
      message.partyAAmount,
      requestedPartyAAmount,
      "Solver quote doesn't match requested PartyA amount"
    );
    assert.equal(
      message.partyBAmount,
      requestedPartyBAmount,
      "Solver quote doesn't match requested PartyB amount"
    );
    assert.ok(
      message.instantWithdrawFee <= parseEther("2"),
      "Solver fee too high"
    );

    // If quote acceptable, PartyA signs it
    const signature = await partyA.signTypedData({
      domain,
      types,
      primaryType: "InstantWithdraw",
      message,
    });

    // Track all balances before execution
    const initialBalances = {
      partyA: await mockSymm.read.balanceOf([partyA.account.address]),
      partyB: await mockSymm.read.balanceOf([partyB.account.address]),
      contract: await mockSymm.read.balanceOf([etfSettlement.address])
    };

    // Verify solver (PartyB) has enough balance to take over position
    assert.ok(
      initialBalances.partyB >= message.partyBAmount,
      "Solver has insufficient balance to take over position"
    );

    const instantWithdrawTx = await etfSettlement.write.executeInstantWithdraw(
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
      {
        hash: instantWithdrawTx,
      }
    );

    // Check event
    const INSTANT_WITHDRAW_EVENT = keccak256(
      toHex("InstantWithdrawExecuted(bytes32,address,uint256)")
    );
    const instantWithdrawEvent = instantWithdrawReceipt.logs.find((log) => {
      // Skip Transfer events
      if (
        log.topics[0] === keccak256(toHex("Transfer(address,address,uint256)"))
      ) {
        return false;
      }
      return log.topics[0] === INSTANT_WITHDRAW_EVENT;
    });

    assert.ok(instantWithdrawEvent, "Instant withdraw event not emitted");
    assert.equal(
      instantWithdrawEvent.topics[1],
      settlementId,
      "Incorrect settlement ID in event"
    );
    // Decode the event log to get all parameters including the indexed ones
    const decodedLog = decodeEventLog({
      abi: parseAbi([
        "event InstantWithdrawExecuted(bytes32 indexed settlementId, address indexed replacedParty, uint256 fee)",
      ]),
      data: instantWithdrawEvent.data,
      topics: instantWithdrawEvent.topics,
    });

    assert.equal(
      getAddress(decodedLog.args.replacedParty),
      getAddress(replacedParty),
      "Incorrect replaced party in event"
    );

    assert.equal(
      decodedLog.args.fee,
      instantWithdrawFee,
      "Incorrect instant withdraw fee in event"
    );

    // Get final balances after execution
    const finalBalances = {
      partyA: await mockSymm.read.balanceOf([partyA.account.address]),
      partyB: await mockSymm.read.balanceOf([partyB.account.address]), 
      contract: await mockSymm.read.balanceOf([etfSettlement.address])
    };

    const settlement = await etfSettlement.read.getSettlementData([settlementId]);

    // Verify settlement state transitions
    assert.equal(settlement.state, 1, "Settlement should be in Settled state");

    // Verify balance changes
    assert.equal(
      finalBalances.partyA - initialBalances.partyA,
      partyAAmount,
      "PartyA balance change incorrect"
    );
    assert.equal(
      finalBalances.partyB - initialBalances.partyB,
      partyBAmount + instantWithdrawFee,
      "PartyB (solver) balance change incorrect - should receive position amount + fee"
    );
    assert.equal(
      initialBalances.contract - finalBalances.contract,
      partyAAmount + partyBAmount + instantWithdrawFee,
      "Contract balance change incorrect - should decrease by total distributed amount"
    );
  });

  it("should fail instant withdraw with invalid signature", async function () {
    const { mockSymm, mockWeth, etfSettlement, partyA, partyB } =
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

    const replacedParty = partyA.account.address;
    const instantWithdrawFee = parseEther("1");
    const partyAAmount = parseEther("80");
    const partyBAmount = parseEther("20");

    const hash = await etfSettlement.write.createETFSettlement(
      [
        partyA.account.address,
        partyB.account.address,
        partyACollateral,
        mockSymm.address,
        etfParams,
      ],
      {
        account: partyA.account,
      }
    );

    // Mint tokens to the contract to cover potential withdrawals
    const totalAmount = partyAAmount + partyBAmount + instantWithdrawFee;
    await mockSymm.write.mint([etfSettlement.address, totalAmount]);

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
      version: "1.0.0",
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      InstantWithdraw: [
        { name: "settlementId", type: "bytes32" },
        { name: "replacedParty", type: "address" },
        { name: "instantWithdrawFee", type: "uint256" },
        { name: "partyAAmount", type: "uint256" },
        { name: "partyBAmount", type: "uint256" },
      ],
    };

    const message = {
      settlementId,
      replacedParty,
      instantWithdrawFee,
      partyAAmount,
      partyBAmount,
    };

    // Record initial states and balances
    const initialSettlement = await etfSettlement.read.getSettlementData([settlementId]);
    const initialBalances = {
      partyA: await mockSymm.read.balanceOf([partyA.account.address]),
      partyB: await mockSymm.read.balanceOf([partyB.account.address]),
      contract: await mockSymm.read.balanceOf([etfSettlement.address])
    };

    // Intentionally sign with partyB instead of partyA to create an invalid signature
    const signature = await partyB.signTypedData({
      domain,
      types,
      primaryType: "InstantWithdraw",
      message,
    });

    // Verify transaction reverts with correct error
    await assert.rejects(
      async () => {
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
      },
      {
        message: /Invalid signature/,
      }
    );

    // Verify no state changes occurred
    const finalSettlement = await etfSettlement.read.getSettlementData([settlementId]);
    const finalBalances = {
      partyA: await mockSymm.read.balanceOf([partyA.account.address]),
      partyB: await mockSymm.read.balanceOf([partyB.account.address]),
      contract: await mockSymm.read.balanceOf([etfSettlement.address])
    };

    // Verify settlement state unchanged
    assert.deepEqual(finalSettlement, initialSettlement, "Settlement state should not change");

    // Verify balances unchanged
    assert.equal(finalBalances.partyA, initialBalances.partyA, "PartyA balance should not change");
    assert.equal(finalBalances.partyB, initialBalances.partyB, "PartyB balance should not change");
    assert.equal(finalBalances.contract, initialBalances.contract, "Contract balance should not change");

    // Verify no event was emitted for invalid signature
    const instantWithdrawTx = etfSettlement.write.executeInstantWithdraw(
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

    await assert.rejects(
      async () => {
        await publicClient.waitForTransactionReceipt({
          hash: await instantWithdrawTx,
        });
      },
      {
        message: /Invalid signature/,
      }
    );
  });
}

module.exports = {
  shouldExecuteInstantWithdraw,
};
