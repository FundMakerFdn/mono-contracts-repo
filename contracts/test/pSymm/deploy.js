const assert = require("node:assert/strict");
const hre = require("hardhat");
const { keccak256, pad, hexToBytes, bytesToHex } = require("viem");

const CHAIN_ID = {
  ARBITRUM: 42161,
  BASE: 8453,
  HARDHAT: 31337,
};

/**
 * Converts an Ethereum address to a padded uint256 hex value
 * @param {string} address - The Ethereum address to convert
 * @return {string} The padded uint256 hex value
 */
function convertAddressToX(address) {
  const addressBytes = hexToBytes(address);
  const paddedAddress = pad(addressBytes, { size: 32 });
  const uint256Value = bytesToHex(paddedAddress);
  return uint256Value;
}

/**
 * Deploys all contracts and sets up initial state for testing
 * @return {Object} The deployed contracts and test accounts
 */
async function deployFixture() {
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();

  // Deploy PSYMM contracts
  // const psymm_partyA = await hre.viem.deployContract("PSYMM");
  // const psymm_partyB = await hre.viem.deployContract("PSYMM");
  const psymm = await hre.viem.deployContract("PSYMM");

  // Deploy PartyRegistry
  const partyRegistry = await hre.viem.deployContract("PartyRegistry");

  // Deploy and configure mock tokens
  const USDC_PRECISION = 6;
  const USDC = await hre.viem.deployContract("MockERC20", [
    "Mock USDC",
    "USDC",
  ]);

  // Mint tokens to test accounts
  await USDC.write.mint([partyA.account.address, 10 * 10 ** USDC_PRECISION]);
  await USDC.write.mint([partyB.account.address, 10 * 10 ** USDC_PRECISION]);

  // Register parties in the registry
  const partyAData = {
    role: "Trader",
    ipAddress: "127.0.0.2",
    partyType: 1,
  };

  const partyBData = {
    role: "Solver",
    ipAddress: "127.0.0.1",
    partyType: 2,
  };

  // Guardian data for solver and trader
  const guardianSolverData = {
    ipGuardian: "127.0.0.3",
    ipParty: "127.0.0.1", // Solver's IP
  };

  const guardianTraderData = {
    ipGuardian: "127.0.0.4",
    ipParty: "127.0.0.2", // Trader's IP
  };

  // Register partyA
  await partyRegistry.write.registerParty([partyAData], {
    account: partyA.account,
  });

  // Register partyB
  await partyRegistry.write.registerParty([partyBData], {
    account: partyB.account,
  });

  // Register guardian data for solver
  await partyRegistry.write.registerGuardianData([guardianSolverData], {
    account: partyB.account,
  });

  // Register guardian data for trader
  await partyRegistry.write.registerGuardianData([guardianTraderData], {
    account: partyA.account,
  });

  // Generate custody IDs
  // const custodyId_A = keccak256(pad(0));
  // const custodyId_B = keccak256(pad(1));

  return {
    psymm,
    partyRegistry,
    USDC,
    deployer,
    partyA,
    partyB,
    USDC_PRECISION,
    guardianSolverData,
    guardianTraderData,
    // custodyId_A,
    // custodyId_B,
  };
}

async function deployFixtureMultichain() {
  return; // TODO / not implemented
  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy PSYMM contracts
  // const psymm_partyA = await hre.viem.deployContract("PSYMM");
  // const psymm_partyB = await hre.viem.deployContract("PSYMM");

  // Deploy and configure mock tokens
  const USDC_PRECISION = 6;
  const USDC = await hre.viem.deployContract("MockERC20", [
    "Mock USDC",
    "USDC",
  ]);

  const USDE_PRECISION = 18;
  const USDE = await hre.viem.deployContract("MockERC20", [
    "Mock USDE",
    "USDE",
  ]);

  // Mint tokens to test accounts
  await USDC.write.mint([partyA.account.address, 10 * 10 ** USDC_PRECISION]);
  await USDE.write.mint([partyB.account.address, 10 * 10 ** USDE_PRECISION]);

  // Verify initial balances
  assert.equal(
    BigInt(await USDC.read.balanceOf([partyA.account.address])),
    BigInt(10 * 10 ** USDC_PRECISION),
    "USDC balance should be 10"
  );
  assert.equal(
    BigInt(await USDE.read.balanceOf([partyB.account.address])),
    BigInt(10 * 10 ** USDE_PRECISION),
    "USDE balance should be 10"
  );

  // Generate custody IDs
  // const custodyId_A = keccak256(pad(0));
  // const custodyId_B = keccak256(pad(1));

  return {
    psymm_partyA,
    psymm_partyB,
    USDC,
    USDE,
    deployer,
    partyA,
    partyB,
    publicClient,
    USDC_PRECISION,
    USDE_PRECISION,
    // custodyId_A,
    // custodyId_B,
  };
}

module.exports = {
  deployFixture,
  convertAddressToX,
  CHAIN_ID,
};

async function main() {
  const contracts = await deployFixture();

  // Prepare data for output
  const outputData = {
    psymm: contracts.psymm.address,
    partyRegistry: contracts.partyRegistry.address,
    USDC: contracts.USDC.address,
    deployer: contracts.deployer.account.address,
    partyA: contracts.partyA.account.address,
    partyB: contracts.partyB.account.address,
    USDC_PRECISION: contracts.USDC_PRECISION,
    guardianSolver: contracts.guardianSolverData,
    guardianTrader: contracts.guardianTraderData,
  };

  // Write to file
  const fs = require("fs");
  fs.writeFileSync("./contracts.tmp.json", JSON.stringify(outputData, null, 2));

  console.log("Contract data written to ./contracts.tmp.json");
  return contracts;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
