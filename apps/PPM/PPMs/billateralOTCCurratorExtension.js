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

  // --- Define Items with Automatic Expansion ---
  ppmItems.push(...ppmItems);

  addPPM({
    type: "changeCustodyState",
    chainId: CHAIN_ID.BSC,
    pSymm: pSymm.BSC,
    state: STATE.DEFAULT,
    args: { newState: STATE.DISPUTE },
    party: [guardian1Pub, guardian2Pub, curratorPub]
  });
