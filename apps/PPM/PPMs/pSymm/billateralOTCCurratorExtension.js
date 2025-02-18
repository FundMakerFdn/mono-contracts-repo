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
  } from "../globalVariables.js";
  import { addPPM } from "../ppmBuilder.js";
  import {ppmItems} from "./billateralOTC.js";
  
  // --- Setup Keys and Multisigs ---
  const partyAKey = partyAKey;
  const partyAPub = partyAPub;
  const partyBKey = partyBKey;
  const partyBPub = partyBPub;
  const curratorKey = partyCPk;
  const curratorPub = partyCPub;
  const guardian1Key = guardian1Key;
  const guardian1Pub = guardian1Pub;
  const guardian2Key = guardian2Key;
  const guardian2Pub = guardian2Pub;

  const ABMultisig = [partyAKey, partyBKey];
  const CurratorMultisig = [curratorPub, guardian1Pub, guardian2Pub];

  // --- Define Items with Automatic Expansion ---
  ppmItems.push(...ppmItems);

  addPPM({
    type: "custodyToAddress",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: { receiver: partyAPub },
    party: [ABMultisig, CurratorMultisig]
  });

  addPPM({
    type: "custodyToAddress",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: { receiver: partyBPub },
    party: [ABMultisig, CurratorMultisig]
  });

  // SMA calls – Paraswap SMA
addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DISPUTE,
  args: {
  smaType:"paraswap",
  tokenInput: TOKEN.ETH.BSC,
  tokenOutput: TOKEN.USDC.BSC,
  maxSpread: 0.01,
  },
  party: [partyAPub, partyBPub, settleMaker.BSC, curratorPub],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.ETH,
  pSymm: pSymm.ETH,
  state: STATE.DISPUTE,
  args: {
      smaType:"paraswap",
      tokenInput: TOKEN.ETH.ETH,
      tokenOutput: TOKEN.USDC.ETH,
      maxSpread: 0.01,
  },
  party: [partyAPub, partyBPub, settleMaker.ETH, curratorPub],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DISPUTE,
  args: {
  smaType:"paraswap",
  tokenInput: TOKEN.SYMM.BSC,
  tokenOutput: TOKEN.USDC.BSC,
      maxSpread: 0.01,
  },
  party: [partyAPub, partyBPub, settleMaker.BSC, curratorPub],
});

addPPM({
  type: "callSMA",
  chainId: CHAIN_ID.ETH,
  pSymm: pSymm.ETH,
  state: STATE.DISPUTE,
  args: {
      smaType:"paraswap",
      tokenInput: TOKEN.SYMM.ETH,
      tokenOutput: TOKEN.USDC.ETH,
      maxSpread: 0.01,
  },
  party: [partyAPub, partyBPub, settleMaker.ETH, curratorPub],
});

  // --- Change Custody State ---

  addPPM({
    type: "changeCustodyState",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: { newState: STATE.DISPUTE },
    party: [partyAPub, partyBPub, curratorPub, guardian1Pub, guardian2Pub],
  });