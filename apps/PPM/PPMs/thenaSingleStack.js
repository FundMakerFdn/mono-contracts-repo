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
} from "./globalVariables.js"

const curratorKey = partyAPk;
const curratorPub = partyAPub;
const guardianKey = partyBPk;
const guardianPub = partyBPub;
const ownerKey = partyCPk;
const ownerPub = partyCPub;

const curratorMultisig = aggregatePublicKeys([curratorKey, guardianKey]);

const transferToOwner = {
    index: 1,
    type: "custodyToAddress",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    party: curratorMultisig,
    args: {
      receiver: ownerPub,
    }
  };

  const disputeTransferToOwner = {
    index: 5,
    type: "dispute",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    party: settleMaker_BSC,
    args: {
        token: ownerPub,
    }
  };

// SMA deployment
const deployAaveSMA = {
    index: 2,
    type: "deploySMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    party: curratorMultisig,
    args: {
    }
  };
// TODO Thena SMA
// TODO Venus SMA

// SMA transfers
const transferToAaveSMA = {
    index: 2,
    type: "custodyToSMA",
    chainId: BSC_CHAIN_ID,
    pSymm: pSymm_BSC,
    party: curratorMultisig,
    args: {
        token: USDC_TOKEN_BSC,
    }
  };

// SMA calls
    // Aave SMA
    const callAaveBorrow = {
        index: 3,
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        party: curratorMultisig,
        args: {
            token: USDC_TOKEN_BSC,
        }
    };

    const callAaveRepay = {
        index: 4,
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        party: curratorMultisig,
        args: {
            token: USDC_TOKEN_BSC,
        }
    };
    // Paraswap SMA
    const callParaswapUSDCETH = {
        index: 6,
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        party: curratorMultisig,
        args: {
            tokenInput: USDC_TOKEN_BSC,
            tokenOutput: ETH_TOKEN_BSC,
            maxSpread: 0.1,
        }
    };

    const callParaswapETHUSDC = {
        index: 7,
        type: "callSMA",
        chainId: BSC_CHAIN_ID,
        pSymm: pSymm_BSC,
        party: curratorMultisig,
        args: {
            tokenInput: ETH_TOKEN_BSC,
            tokenOutput: USDC_TOKEN_BSC,
            maxSpread: 0.1,
        }
    };
    

const PPM = [
    transferToOwner,
    disputeTransferToOwner,
    deployAaveSMA,
    transferToAaveSMA,
    callAaveBorrow,
    callAaveRepay,
    callParaswapUSDCETH,
    callParaswapETHUSDC,
]

export default PPM;