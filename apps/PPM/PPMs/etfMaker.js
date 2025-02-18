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
  const curratorKey = partyAKey;
  const curratorPub = partyAPub;
  const guardian1Key = partyBKey;
  const guardian1Pub = partyBPub;
  const guardian2Key = partyCKey;
  const guardian2Pub = partyCPub;
  
  const curratorMultisig = [curratorKey, guardian1Key, guardian2Key];
  
  // --- Define Items with Automatic Expansion ---
  addPPM({
    type: "custodyToAddress",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DISPUTE,
    args: { receiver: ownerPub },
    party: settleMaker.BSC,
  });
  
// SMA deployment
addPPM({
    type: "deploySMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {smaType:"aave", factoryAddress: "0x0"},
    party: curratorMultisig,
  });

// SMA transfers
   addPPM({
    type: "custodyToSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {smaType:"ETFMaker", token: TOKEN.USDC.BSC },
    party: curratorMultisig,
  });

  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {smaType:"ETFMaker", function: "smaToCustody"},
    party: curratorMultisig,
  });

  // ETFMaker SMA
  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {smaType:"ETFMaker", function: "mint"},
    party: curratorMultisig,
  });

  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {smaType:"ETFMaker", function: "burn"},
    party: curratorMultisig,
  });

  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: {smaType:"ETFMaker", function: "withdraw"},
    party: curratorMultisig,
  });

  // SMA disputes
  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DISPUTE,
    args: {smaType:"ETFMaker", function: "mint"},
    party: settleMaker.BSC,
  });

  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DISPUTE,
    args: {smaType:"ETFMaker", function: "burn"},
    party: settleMaker.BSC,
  });

  addPPM({
    type: "callSMA",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DISPUTE,
    args: {smaType:"ETFMaker", function: "withdraw"},
    party: settleMaker.BSC,
  });

  // State changes
  addPPM({
    type: "changeCustodyState",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: { newState: STATE.DISPUTE },
    party: [guardian1Pub, guardian2Pub, curratorPub]
  });

  export default ppmItems;
  