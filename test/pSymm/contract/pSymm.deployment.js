const assert = require("node:assert/strict");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const {
  parseEther,
  getAddress,
  keccak256,
  toHex,
  decodeEventLog,
} = require("viem");
const { getSettlementIdFromReceipt, deployFixture: deployFixtureSettleMaker } = require("../../SettleMaker/SettleMaker.deployment");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");

// Helper to create merkle tree from settlements
function createInitialMerkleTree(leaves) {
  return StandardMerkleTree.of(leaves, ["bytes32"]);
}

async function deployFixture() {
  // Get base deployment from SettleMaker
  const baseDeployment = await deployFixtureSettleMaker();
  
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy mockUSDC
  const mockUSDC = await hre.viem.deployContract("MockToken", ["MockUSDC", "mUSDC"]);

  // Deploy pSymm contract
  const pSymm = await hre.viem.deployContract("pSymm");

  // Deploy pSymmSettlement contract
  const pSymmSettlement = await hre.viem.deployContract("pSymmSettlement", [
    baseDeployment.settleMaker.address,
    "pSymmSettlement",
    "1.0",
  ]);

  // Mint mockUSDC tokens to partyA and partyB for depositing
  await mockUSDC.write.mint([partyA.account.address, parseEther("1000")], {
    account: deployer.account,
  });
  await mockUSDC.write.mint([partyB.account.address, parseEther("1000")], {
    account: deployer.account,
  });

  // Ensure mockUSDC is approved for pSymm before depositing
  await mockUSDC.write.approve([pSymm.address, parseEther("1000")], {
    account: partyA.account,
  });
  await mockUSDC.write.approve([pSymm.address, parseEther("1000")], {
    account: partyB.account,
  });

  // Now proceed with the deposit to pSymm
  await pSymm.write.deposit([mockUSDC.address, parseEther("1000"), 1], {
    account: partyA.account,
  });
  await pSymm.write.deposit([mockUSDC.address, parseEther("1000"), 1], {
    account: partyB.account,
  });

  return {
    ...baseDeployment,
    mockUSDC,
    pSymm,
    pSymmSettlement,
    partyA,
    partyB
  };
}



function shouldDeployPSymm() {
  it("should deploy pSymm and pSymmSettlement with correct initial state", async function () {
    const { pSymm, pSymmSettlement, settleMaker, deployer } = await deployFixture();

    // Verify pSymm deployment
    const pSymmAddress = pSymm.address;
    assert.ok(pSymmAddress, "pSymm contract was not deployed");

    // Verify pSymmSettlement deployment
    const pSymmSettlementAddress = pSymmSettlement.address;
    assert.ok(pSymmSettlementAddress, "pSymmSettlement contract was not deployed");

    // Check SettleMaker configuration in pSymmSettlement
    const settleMakerAddress = await pSymmSettlement.read.settleMaker();
    assert.equal(
      getAddress(settleMakerAddress),
      getAddress(settleMaker.address),
      "Incorrect SettleMaker address in pSymmSettlement"
    );

  });

  
}

 

module.exports = {
  shouldDeployPSymm,
  deployFixture,
};
