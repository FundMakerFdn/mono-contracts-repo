import { keccak256, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  SchnorrParty,
  aggregatePublicKeys,
  aggregateNonces,
  computeChallenge,
  combinePartialSignatures,
  verifySignature,
} from "./schnorr.js";
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
    DEFAULT_CUSTODY_STATE,
    DISPUTE_CUSTODY_STATE,
    PAUSE_CUSTODY_STATE,
} from "./globalVariables.js"

const curratorKey = partyAPk;
const curratorPub = partyAPub;
const guardianKey = partyBPk;
const guardianPub = partyBPub;
const ownerKey = partyCPk;
const ownerPub = partyCPub;

const curratorMultisig = [curratorKey, guardianKey];
const ownerMultisig = [ownerKey];

const transferToOwner = {
    type: "custodyToAddress",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_CUSTODY_STATE,
    args: {
      receiver: ownerPub,
    },
    party: curratorMultisig
  };

  const disputeTransferToOwner = {
    type: "custodyToAddress",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DISPUTE_CUSTODY_STATE,
    args: {
    },
    party: settleMaker_BSC
  };

  const pauseTransferToOwner = {
    type: "custodyToAddress",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: PAUSE_CUSTODY_STATE,
    args: {
    },
    party: ownerMultisig
  };

// SMA deployment
const deployAaveSMA = {
    type: "deploySMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_CUSTODY_STATE,
    args: {
    },
    party: curratorMultisig
  };
// TODO Thena SMA
// TODO Venus SMA

// SMA transfers
const transferToAaveSMA = {
    type: "custodyToSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_CUSTODY_STATE,
    args: {
        token: USDC_TOKEN_BSC,
    },
    party: curratorMultisig
  };

  const ownerTransferToAaveSMA = {
    type: "custodyToSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_CUSTODY_STATE,
    args: {
    },
    party: ownerMultisig
  };

  const disputeTransferToAaveSMA = {
    type: "custodyToSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DISPUTE_CUSTODY_STATE,
    args: {
    },
    party: settleMaker_BSC
  };

  const pauseTransferToAaveSMA = {
    type: "custodyToSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: PAUSE_CUSTODY_STATE,
    args: {
    },
    party: ownerMultisig
  };

// SMA calls
    // Aave SMA
    const callAaveBorrow = {
        index: 3,
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {
            token: USDC_TOKEN_BSC,
        },
        party: curratorMultisig
    };

    const ownerCallAaveBorrow = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {},
        party: ownerMultisig
    };

    const disputeCallAaveBorrow = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DISPUTE_CUSTODY_STATE,
        args: {
        },
        party: settleMaker_BSC
    };

    const pauseCallAaveBorrow = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: PAUSE_CUSTODY_STATE,
        args: {
        },
        party: ownerMultisig
    };
    
    const callAaveRepay = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {
        },
        party: curratorMultisig
    };

    const ownerCallAaveRepay = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {},
        party: ownerMultisig
    };

    const disputeCallAaveRepay = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DISPUTE_CUSTODY_STATE,
        args: {
        },
        party: settleMaker_BSC
    };

    const pauseCallAaveRepay = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: PAUSE_CUSTODY_STATE,
        args: {
        },
        party: ownerMultisig
    };

    // Paraswap SMA
    const callParaswapUSDCETH = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {
            tokenInput: USDC_TOKEN_BSC,
            tokenOutput: ETH_TOKEN_BSC,
            maxSpread: 0.1,
        },
        party: curratorMultisig
    };

    const callParaswapETHUSDC = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {
            tokenInput: ETH_TOKEN_BSC,
            tokenOutput: USDC_TOKEN_BSC,
            maxSpread: 0.1,
        },
        party: curratorMultisig
    };

    const ownerCallParaswap = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DEFAULT_CUSTODY_STATE,
        args: {},
        party: ownerMultisig
    };

    const disputeCallParaswap = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: DISPUTE_CUSTODY_STATE,
        args: {
        },
        party: ownerMultisig
    };

    const pauseCallParaswap = {
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        state: PAUSE_CUSTODY_STATE,
        args: {
        },
        party: ownerMultisig
    };

// State changes

const guardianDisputeState = {
    type: "changeCustodyState",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: DEFAULT_CUSTODY_STATE,
    args: {
        oldState: DEFAULT_CUSTODY_STATE,
        newState: DISPUTE_CUSTODY_STATE,
    },
    party: guardianPub
};

const ownerResumeState = {
    type: "changeCustodyState",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    state: PAUSE_CUSTODY_STATE,
    args: {
        oldState: PAUSE_CUSTODY_STATE,
        newState: DEFAULT_CUSTODY_STATE,
    },
    party: ownerMultisig
};

const PPM = [
    transferToOwner,
    disputeTransferToOwner,
    pauseTransferToOwner,
    deployAaveSMA,
    transferToAaveSMA,
    callAaveBorrow,
    callAaveRepay,
    callParaswapUSDCETH,
    callParaswapETHUSDC,
    guardianDisputeState,
    ownerResumeState,
    ownerCallAaveBorrow,
    ownerCallAaveRepay,
    ownerCallParaswap,
    ownerTransferToAaveSMA,
    disputeCallAaveBorrow,
    disputeCallAaveRepay,
    disputeCallParaswap,
    disputeTransferToAaveSMA,
    disputeTransferToOwner,
    pauseCallAaveBorrow,
    pauseCallAaveRepay,
    pauseCallParaswap,
    pauseTransferToAaveSMA,
    pauseTransferToOwner,
   
]

export default PPM;