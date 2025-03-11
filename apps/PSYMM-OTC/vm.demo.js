// Demo script for pSymmSolverVM
const { pSymmSolverVM, timeLog } = require("./vm");

// Mock configuration for the solver VM
const solverConfig = {
  binanceProvider: {
    /* mock binance provider */
  },
  rpcProvider: {
    /* mock RPC provider */
  },
  guardianIP: "192.168.1.100",
  pubKey: "0xSolverPubKey123",
  ppmTemplate: ["TODO-PPM-TEMPLATE"],
};

// Create a solver VM instance
const solverVM = new pSymmSolverVM(solverConfig);

// Mock counterparty IP
const counterpartyIP = "192.168.1.200";

// Simulate the message flow

// Step 1: Initialize the session
timeLog("Initializing session...");
const initResults = solverVM.processMessage(counterpartyIP, { type: "init" });
timeLog(
  `Session initialized, phase: ${solverVM.sessions[counterpartyIP].phase}`
);

// Step 2: Send PPM template request to move to PKXCHG phase
timeLog("Sending PPM template request...");
const ppmRequestResults = solverVM.processMessage(counterpartyIP, {
  type: "peer",
  msg: {
    StandardHeader: { MsgType: "PPMTR" },
  },
});
timeLog(`PPM template sent, phase: ${solverVM.sessions[counterpartyIP].phase}`);
timeLog("PPM template response:", JSON.stringify(ppmRequestResults, null, 2));

// Step 3: Send logon message to move to TRADE phase
timeLog("Sending logon message...");
const logonResults = solverVM.processMessage(counterpartyIP, {
  type: "peer",
  msg: {
    StandardHeader: {
      BeginString: "pSymm.FIX.2.0",
      MsgType: "A",
      DeploymentID: 102,
      SenderCompID: "0xCounterpartyPubKey456",
      TargetCompID: solverConfig.pubKey,
      MsgSeqNum: 1,
      CustodyID: "0xCustody456",
      SendingTime: (Date.now() * 1000000).toString(),
    },
    HeartBtInt: 10,
    GuardianIP: "192.168.1.201",
    StandardTrailer: {
      PublicKey: "0xCounterpartyGuardianPubKey789",
      Signature: "0xCounterpartySignature",
    },
  },
});
timeLog(`Logon complete, phase: ${solverVM.sessions[counterpartyIP].phase}`);
timeLog("Logon response:", JSON.stringify(logonResults, null, 2));

// Display the final session state
timeLog(
  "Final session state:",
  JSON.stringify(solverVM.sessions[counterpartyIP], null, 2)
);

// Now the VM is in TRADE phase and ready for trading messages
