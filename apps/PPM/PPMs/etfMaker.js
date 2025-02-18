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
  
  const curratorMultisig = [curratorKey, guardianKey];
  const ownerMultisig = [ownerKey];
  
  // --- Define Items with Automatic Expansion ---
  addPPM({
    type: "custodyToAddress",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_STATE,
    args: { receiver: ownerPub },
    party: curratorMultisig,
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
   addPPM({
    type: "custodyToSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_STATE,
    args: {smaType:"aave", token: USDC_TOKEN_BSC },
    party: [curratorMultisig, ownerMultisig],
  });

  // ETFMaker SMA
  addPPM({
    type: "callSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    args: {smaType:"ETFMaker"},
    party: curratorMultisig,
  });

  // Paraswap SMA
  addPPM({
    type: "callSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    args: {smaType:"paraswap"},
    party: curratorMultisig,
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

  export default ppmItems;
