import {
  NULL_ADDR,
  CHAIN_ID,
  pSymm,
  STATE,
  TOKEN,
  curratorMultisig,
  ownerMultisig,
} from "./globalVariables.js";

import { PPMBuilder } from "./ppmBuilder.js";

const ppm = new PPMBuilder();

ppm.addItem({
  type: "callSMA",
  chainId: CHAIN_ID.BSC,
  pSymm: pSymm.BSC,
  state: STATE.DEFAULT,
  args: {
    smaType: "aave",
    smaAddress: NULL_ADDR,
    callData: {
      type: "borrow(address,uint256)",
      args: [TOKEN.USDC.BSC], // partial calldata
    },
  },
  // example
  party: [
    {
      parity: 27,
      x: "0x11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd",
    },
    {
      parity: 27,
      x: "0x55667788eeffccdd99999999aabbccdd11223344aabbccdd11223344aabbccdd",
    },
  ],
});

console.log("Merkle root:", ppm.buildTreeRoot());
