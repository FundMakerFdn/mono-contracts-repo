const { parseEther, parseAbi, decodeEventLog, getAddress, keccak256, toHex } = require("viem");

async function setupTestEnvironment(mockSymm, mockWeth, etfSettlement, partyA, partyB) {
  const partyACollateral = parseEther("100");
  const partyBCollateral = parseEther("50");

  await mockSymm.write.approve([etfSettlement.address, partyACollateral], {
    account: partyA.account,
  });
  await mockSymm.write.approve([etfSettlement.address, partyBCollateral], {
    account: partyB.account,
  });

  return {
    partyACollateral,
    partyBCollateral
  };
}

async function createETFSettlement(mockSymm, mockWeth, etfSettlement, partyA, partyB) {
  const { partyACollateral, partyBCollateral } = await setupTestEnvironment(
    mockSymm, 
    mockWeth, 
    etfSettlement, 
    partyA, 
    partyB
  );

  const etfParams = {
    priceMint: parseEther("1000"),
    mintTime: BigInt(Math.floor(Date.now() / 1000)),
    etfTokenAmount: parseEther("10"),
    etfToken: mockWeth.address,
    interestRate: parseEther("0.05"),
    interestRatePayer: partyA.account.address,
  };

  return await etfSettlement.write.createETFSettlement(
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
}

function findEventInLogs(logs, eventSignature, eventName) {
  const eventHash = keccak256(toHex(eventSignature));
  return logs.find((log) => {
    // Skip Transfer events
    if (log.topics[0] === keccak256(toHex("Transfer(address,address,uint256)"))) {
      return false;
    }
    return log.topics[0] === eventHash;
  });
}

module.exports = {
  setupTestEnvironment,
  createETFSettlement,
  findEventInLogs
};
