import { privateKeyToAccount } from "viem/accounts";

// Party Keys
export const partyAKey = BigInt(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);
export const partyBKey = BigInt(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
export const partyCKey = BigInt(
  "0xabc22bb2f244939b77fd888af59e9039dc5a02c8292c1020ef02408d422421b1"
);
export const partyDKey = BigInt(
  "0x6d681d9fedd32cfbcfd99163602e6a709f6072fca0ca2d073fc3df865c448903"
);
export const partyEKey = BigInt(
  "0x42385447480855275238a214b4ad87df1aa0ca6a188961d6f52a6af22c9cde69"
);
export const partyAPub = privateKeyToAccount(
  `0x${partyAKey.toString(16)}`
).publicKey;
export const partyBPub = privateKeyToAccount(
  `0x${partyBKey.toString(16)}`
).publicKey;
export const partyCPub = privateKeyToAccount(
  `0x${partyCKey.toString(16)}`
).publicKey;
export const partyDPub = privateKeyToAccount(
  `0x${partyDKey.toString(16)}`
).publicKey;
export const partyEPub = privateKeyToAccount(
  `0x${partyEKey.toString(16)}`
).publicKey;

export const curratorKey = partyAKey;
export const curratorPub = partyAPub;
export const guardianKey = partyBKey;
export const guardianPub = partyBPub;
export const ownerKey = partyCKey;
export const ownerPub = partyCPub;

export const curratorMultisig = [curratorKey, guardianKey];
export const ownerMultisig = [ownerKey];
// Custody State
export const STATE = {
  DEFAULT: 0,
  DISPUTE: 1,
  PAUSE: 2,
};

export const NULL_ADDR = "0x0000000000000000000000000000000000000000";

// pSymm Deployed Addresses
export const pSymm = {
  BSC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ETH: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
};

// SettleMaker Deployed Addresses
export const settleMaker = {
  BSC: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  ETH: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
};

// Chain IDs
export const CHAIN_ID = {
  BSC: 56,
  ETH: 1,
};

// Token Addresses
export const TOKEN = {
  USDC: {
    BSC: NULL_ADDR,
    ETH: NULL_ADDR,
  },
  ETH: {
    BSC: NULL_ADDR,
    ETH: NULL_ADDR,
  },
  SYMM: {
    BSC: NULL_ADDR,
  },
};
