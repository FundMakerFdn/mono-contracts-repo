import {
  pSymm_BSC,
  settleMaker_BSC,
  BSC_CHAIN_ID,
  USDC_TOKEN_BSC,
  ETH_TOKEN_BSC,
  partyAKey,
  partyBKey,
  partyCPk,
  partyAPub,
  partyBPub,
  partyCPub,
  DEFAULT_STATE,
  DISPUTE_STATE,
  PAUSE_STATE,
} from "./globalVariables.js";
import { addPPM } from "./ppmBuilder.js";

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
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: { receiver: ownerPub },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "custodyToAddress",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DISPUTE_STATE,
  args: {},
  party: settleMaker_BSC,
});

addPPM({
  type: "custodyToAddress",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: PAUSE_STATE,
  args: {},
  party: ownerMultisig,
});

// SMA deployment
addPPM({
  type: "deploySMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {smaType:"aave", factoryAddress: "0x0"},
  party: curratorMultisig,
});

// SMA transfers
//// Custody to SMA
addPPM({
  type: "custodyToSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {smaType:"aave", token: USDC_TOKEN_BSC },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "custodyToSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DISPUTE_STATE,
  args: {smaType:"aave"},
  party: settleMaker_BSC,
});

addPPM({
  type: "custodyToSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: PAUSE_STATE,
  args: {smaType:"aave"},
  party: ownerMultisig,
});

//// SMA to Custody
addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {smaType:"smaToCustody" },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DISPUTE_STATE,
  args: {smaType:"smaToCustody" },
  party: settleMaker_BSC,
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: PAUSE_STATE,
  args: {smaType:"smaToCustody" },
  party: ownerMultisig,
});

// SMA calls – Aave
addPPM({
  index: 3,
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {smaType:"aave", function: "borrow", token: USDC_TOKEN_BSC },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {smaType:"aave", function: "repay", token: USDC_TOKEN_BSC },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: PAUSE_STATE,
  args: {smaType:"aave"},
  party: ownerMultisig,
});

// SMA calls – Paraswap SMA
addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {
    smaType:"paraswap",
    tokenInput: USDC_TOKEN_BSC,
    tokenOutput: ETH_TOKEN_BSC,
    maxSpread: 0.1,
  },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: {
    smaType:"paraswap",
    tokenInput: ETH_TOKEN_BSC,
    tokenOutput: USDC_TOKEN_BSC,
    maxSpread: 0.1,
  },
  party: [curratorMultisig, ownerMultisig],
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DISPUTE_STATE,
  args: {smaType:"paraswap"},
  party: ownerMultisig,
});

addPPM({
  type: "callSMA",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: PAUSE_STATE,
  args: {smaType:"paraswap"},
  party: ownerMultisig,
});

// State changes
addPPM({
  type: "changeCustodyState",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: { newState: DISPUTE_STATE },
  party: [guardianPub, ownerMultisig, curratorPub]
});

addPPM({
  type: "changeCustodyState",
  chainId: BSC_CHAIN_ID,
  pSymm: pSymm_BSC,
  state: DEFAULT_STATE,
  args: { newState: PAUSE_STATE },
  party: [guardianPub, ownerMultisig]
});

addPPM({
    type: "changeCustodyState",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: PAUSE_STATE,
    args: { newState: DEFAULT_STATE },
    party: ownerMultisig,
  });

// TODO add venus and Thena

export default ppmItems;
