import {
  partyAKey,
  partyBKey,
  partyCPk,
  partyAPub,
  partyBPub,
  partyCPub,
  pSymm,
  settleMaker,
  CHAIN_ID,
  TOKEN,
  STATE,
} from "../globalVariables.js";
import { addPPM } from "../ppmBuilder.js";

// --- Global Storage and Helper ---
const ppmItems = [];

// --- Setup Keys and Multisigs ---
const curratorKey = partyAKey;
const curratorPub = partyAPub;
const guardianKey = partyBKey;
const guardianPub = partyBPub;
const ownerKey = partyCPk;
const ownerPub = partyCPub;

const curratorMultisig = [curratorKey, guardianKey];
const ownerMultisig = [ownerKey];

// --- Define Items with Automatic Expansion ---
addPPM({
  type: "custodyToAddress",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { receiver: ownerPub },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "custodyToAddress",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DISPUTE,
  args: {},
  party: settleMaker.BSC,
});

addPPM({
  type: "custodyToAddress",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.PAUSE,
  args: {},
  party: ownerMultisig,
});

// SMA deployment
addPPM({
  type: "deploySMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { smaType: "aave", factoryAddress: "0x0" },
  party: curratorMultisig,
});

// SMA transfers
//// Custody to SMA
addPPM({
  type: "custodyToSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { smaType: "aave", token: TOKEN.USDC.BSC },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "custodyToSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DISPUTE,
  args: { smaType: "aave" },
  party: settleMaker.BSC,
});

addPPM({
  type: "custodyToSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.PAUSE,
  args: { smaType: "aave" },
  party: ownerMultisig,
});

//// SMA to Custody
addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { smaType: "smaToCustody" },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DISPUTE,
  args: { smaType: "smaToCustody" },
  party: settleMaker.BSC,
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.PAUSE,
  args: { smaType: "smaToCustody" },
  party: ownerMultisig,
});

// SMA calls – Aave
addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { smaType: "aave", function: "borrow", token: TOKEN.USDC.BSC },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { smaType: "aave", function: "repay", token: TOKEN.USDC.BSC },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.PAUSE,
  args: { smaType: "aave" },
  party: ownerMultisig,
});

// SMA calls – Paraswap SMA
addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: {
    smaType: "paraswap",
    tokenInput: TOKEN.USDC.BSC,
    tokenOutput: TOKEN.ETH.BSC,
    maxSpread: 0.01,
  },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: {
    smaType: "paraswap",
    tokenInput: TOKEN.ETH.BSC,
    tokenOutput: TOKEN.USDC.BSC,
    maxSpread: 0.1,
  },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DISPUTE,
  args: { smaType: "paraswap" },
  party: ownerMultisig,
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.PAUSE,
  args: { smaType: "paraswap" },
  party: ownerMultisig,
});

// State changes
addPPM({
  type: "changeCustodyState",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { newState: STATE.DISPUTE },
  party: [guardianPub, ownerMultisig, curratorPub],
});

addPPM({
  type: "changeCustodyState",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { newState: STATE.PAUSE },
  party: [guardianPub, ownerMultisig],
});

addPPM({
  type: "changeCustodyState",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.PAUSE,
  args: { newState: STATE.DEFAULT },
  party: ownerMultisig,
});

// TODO add venus and Thena

export default ppmItems;
