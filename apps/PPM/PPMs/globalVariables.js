
// Party Keys
const partyAPk = BigInt("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const partyBPk = BigInt("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const partyCPk = BigInt("0xabc22bb2f244939b77fd888af59e9039dc5a02c8292c1020ef02408d422421b1");

const partyAPub = privateKeyToAccount(`0x${partyAPk.toString(16)}`).publicKey;
const partyBPub = privateKeyToAccount(`0x${partyBPk.toString(16)}`).publicKey;
const partyCPub = privateKeyToAccount(`0x${partyCPk.toString(16)}`).publicKey;

// Custody State
const STATE = {
    DEFAILT: 0,
    DISPUTE: 1,
    PAUSE: 2
  };

// pSymm Deployed Addresses
const pSymm = {
    BSC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    ETH: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  };

// SettleMaker Deployed Addresses
const settleMaker = {
    BSC: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ETH: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  };

// Chain IDs
const CHAIN_ID = {
    BSC: 56,
    ETH: 1
  };

// Token Addresses
const TOKEN = {
    USDC: {
      BSC: "0x0000000000000000000000000000000000000000",
      ETH: "0x0000000000000000000000000000000000000000"
    },
    ETH: {
      BSC: "0x0000000000000000000000000000000000000000",
      ETH: "0x0000000000000000000000000000000000000000"
    }
  };