const assert = require("node:assert/strict");
const hre = require("hardhat");
const { keccak256, concat, pad, hexToBytes, bytesToHex, toBytes, encodeAbiParameters } = require("viem");
const { keyFromSeed } = require("#root/apps/PSYMM-OTC/common.js");
const { secp256k1 } = require("@noble/curves/secp256k1");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

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

async function deployFixture() {

  const [deployer, partyA, partyB] = await hre.viem.getWalletClients();

  const indexRegistry = await hre.viem.deployContract("IndexRegistry");
  const psymm = await hre.viem.deployContract("PSYMM");
  const IndexFactory = hre.viem.deployContract("IndexFactory", [psymm.address]);
  const USDC_PRECISION = 6;
  const USDC = await hre.viem.deployContract("MockERC20", [
    "Mock USDC",
    "USDC",
  ]);

  // Mint tokens to test accounts
  await USDC.write.mint([partyA.account.address, 10 * 10 ** USDC_PRECISION]);
  await USDC.write.mint([partyB.account.address, 10 * 10 ** USDC_PRECISION]);

  const IndexDatas = {
    name: "PanteraIndex",
    ticker: "SYPC",
    curatorFee: 1,
    }

  const curratorWeights = [{
    indexId : 1,
    timestamp : 1743465600,
    weights : "",
    price : 10,
    }]

  await indexRegistry.write.registerIndex([IndexDatas.name, IndexDatas.ticker, IndexDatas.curatorFee], {
    account: partyA.account,
  });

  const data1 = await indexRegistry.read.getIndexDatas([1]);

  const i = 0;
  await indexRegistry.write.setCuratorWeights([curratorWeights[i].indexId, curratorWeights[i].timestamp, curratorWeights[i].weights, curratorWeights[i].price], {
    account: partyA.account,
  });
  
  const data2 = await indexRegistry.read.getData([1, 1743465600, partyA.account.address]);

  const solverKey = keyFromSeed(0);

  function toPPMKey(pubKeyHex) {
    const point = secp256k1.ProjectivePoint.fromHex(hexToBytes(pubKeyHex));
    return {
      parity: point.hasEvenY() ? 27 : 28,
      x: `0x${point.x.toString(16).padStart(64, "0")}`,
    };
  }

  const partyBData = {
    role: "Solver",
    ipAddress: "127.0.0.1",
    partyType: 2,
    pubKey: toPPMKey(solverKey.pubKey),
  };

  await USDC.write.approve([psymm.address, 10 * 10 ** USDC_PRECISION], {
    account: partyA.account,
  });

  const amount = 5n * 10n ** BigInt(USDC_PRECISION);
    const destination = partyB.account.address;

    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const pubKey = { parity: 0, x: convertAddressToX(partyA.account.address) };
    const sig = {
      px: keccak256(toBytes("mock-px")),
      e: keccak256(toBytes("mock-e")),
      s: keccak256(toBytes("mock-s")),
    };

    // Construct the leaf exactly as the contract does
    const leafData = encodeAbiParameters(
      [
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint8" },
        { type: "bytes" },
        { type: "uint8" },
        { type: "bytes32" },
      ],
      [
        "custodyToAddress",
        CHAIN_ID.HARDHAT,
        psymm.address,
        0,
        encodeAbiParameters([{ type: "address" }], [destination]), // Nested encoding for encodedParams
        0,
        pubKey.x,
      ]
    );
    const leaf = keccak256(concat([keccak256(leafData)]));

    // Single-leaf tree: root = leaf, proof = []
    const root = leaf;
    const proof = [];

  await psymm.write.addressToCustody(
    [custodyId_A, USDC.address, 10 * 10 ** USDC_PRECISION],
    { account: partyA.account }
  );

  console.log("Sucess!!");

  return {
    indexRegistry,
    deployer,
    partyA,
    partyB,
  };
}

module.exports = {
  deployFixture,
};

async function main() {
  const contracts = await deployFixture();

  // Prepare data for output
  const outputData = {
    indexRegistry: contracts.indexRegistry.address,
    deployer: contracts.deployer.account.address,
    partyA: contracts.partyA.account.address,
    partyB: contracts.partyB.account.address,
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