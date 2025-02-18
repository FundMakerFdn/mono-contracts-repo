// @notice multicollateral + multichain

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
  } from "./globalVariables.js";
  import { addPPM } from "./ppmBuilder.js";
  
  // --- Global Storage and Helper ---
  const ppmItems = [];
  
  // --- Setup Keys and Multisigs ---
  const partyAKey = partyAKey;
  const partyAPub = partyAPub;
  const partyBKey = partyBKey;
  const partyBPub = partyBPub;

  const ABMultisig = [partyAKey, partyBKey];

  // --- Define Items with Automatic Expansion ---
addPPM({
    type: "custodyToAddress",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {},
    party: ABMultisig,
});

addPPM({
    type: "custodyToAddress",
    chainId: CHAIN_ID.ETH,
    pSymm: pSymm.ETH,
    state: STATE.DEFAULT,
    args: {},
    party: ABMultisig,
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
    chainId: CHAIN_ID.ETH,
    pSymm: pSymm.ETH,
    state: STATE.DISPUTE,
    args: {},
    party: settleMaker.ETH,
});

// SMA calls – Paraswap SMA
addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {
    smaType:"paraswap",
    tokenInput: TOKEN.ETH.BSC,
    tokenOutput: TOKEN.USDC.BSC,
    maxSpread: 0.01,
    },
    party: [partyAKey, partyBKey, settleMaker.BSC],
});

addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.ETH,
    pSymm: pSymm.ETH,
    state: STATE.DEFAULT,
    args: {
        smaType:"paraswap",
        tokenInput: TOKEN.ETH.ETH,
        tokenOutput: TOKEN.USDC.ETH,
        maxSpread: 0.01,
    },
    party: [partyAKey, partyBKey, settleMaker.ETH],
});

addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {
    smaType:"paraswap",
    tokenInput: TOKEN.SYMM.BSC,
    tokenOutput: TOKEN.USDC.BSC,
        maxSpread: 0.01,
    },
    party: [partyAKey, partyBKey, settleMaker.BSC],
});

addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.ETH,
    pSymm: pSymm.ETH,
    state: STATE.DEFAULT,
    args: {
        smaType:"paraswap",
        tokenInput: TOKEN.SYMM.ETH,
        tokenOutput: TOKEN.USDC.ETH,
        maxSpread: 0.01,
    },
    party: [partyAKey, partyBKey, settleMaker.ETH],
});
  
// --- State Changes ---
addPPM({
  type: "changeCustodyState",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: { newState: STATE.DISPUTE },
  party: [partyAKey, partyBKey],
});

addPPM({
  type: "changeCustodyState",
  chainId: CHAIN_ID.ETH,
  pSymm: pSymm.ETH,
  state: STATE.DEFAULT,
  args: { newState: STATE.DISPUTE },
  party: [partyAKey, partyBKey],
});

export default ppmItems;