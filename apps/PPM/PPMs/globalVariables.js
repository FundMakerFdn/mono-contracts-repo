
// Party Keys
const partyAPk = BigInt("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const partyBPk = BigInt("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const partyCPk = BigInt("0xabc22bb2f244939b77fd888af59e9039dc5a02c8292c1020ef02408d422421b1");

const partyAPub = privateKeyToAccount(`0x${partyAPk.toString(16)}`).publicKey;
const partyBPub = privateKeyToAccount(`0x${partyBPk.toString(16)}`).publicKey;
const partyCPub = privateKeyToAccount(`0x${partyCPk.toString(16)}`).publicKey;

// Custody State
const DEFAULT_CUSTODY_STATE = 0;
const DISPUTE_CUSTODY_STATE = 1;
const PAUSE_CUSTODY_STATE = 2;

// pSymm Deployed Addresses
const pSymm_BSC = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const pSymm_ETH = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// SettleMaker Deployed Addresses
const settleMaker_BSC = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const settleMaker_ETH = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

// Chain IDs
const BSC_CHAIN_ID = 56;
const ETH_CHAIN_ID = 1;

// USDC Token Addresses
const USDC_TOKEN_BSC = "0x0000000000000000000000000000000000000000";
const USDC_TOKEN_ETH = "0x0000000000000000000000000000000000000000";

// ETH Token Addresses
const ETH_TOKEN_BSC = "0x0000000000000000000000000000000000000000";
const ETH_TOKEN_ETH = "0x0000000000000000000000000000000000000000";

