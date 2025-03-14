const { pSymmVM, pSymmSolverVM, pSymmTraderVM, timeLog } = require('./vm');

// Mock IP addresses for demonstration
const SOLVER_IP = '10.0.0.1';
const TRADER_IP = '10.0.0.2';
const SOLVER_GUARDIAN_IP = '10.0.0.3';
const TRADER_GUARDIAN_IP = '10.0.0.4';

// Mock public keys
const SOLVER_PUBKEY = '0xSolverPubKey123';
const TRADER_PUBKEY = '0xTraderPubKey456';
const SOLVER_GUARDIAN_PUBKEY = '0xSolverGuardianPubKey789';
const TRADER_GUARDIAN_PUBKEY = '0xTraderGuardianPubKey012';

// PPM Template as specified
const ppmTemplate = [
  { party: "owner", property: 123 },
  { party: "guardian", property: 234 },
];

// Create VM instances
const solverVM = new pSymmSolverVM({
  binanceProvider: {},
  rpcProvider: {},
  guardianIP: SOLVER_GUARDIAN_IP,
  guardianPubKey: SOLVER_GUARDIAN_PUBKEY,
  pubKey: SOLVER_PUBKEY,
  ppmTemplate: ppmTemplate
});

const traderVM = new pSymmTraderVM({
  binanceProvider: {},
  rpcProvider: {},
  guardianIP: TRADER_GUARDIAN_IP,
  guardianPubKey: TRADER_GUARDIAN_PUBKEY,
  pubKey: TRADER_PUBKEY
});

// Simulate message delivery between VMs
function deliverMessage(fromVM, toVM, fromIP, toIP, message) {
  timeLog(`Delivering message from ${fromIP} to ${toIP}:`, message);
  
  // Process the message in the receiving VM
  const responses = toVM.processMessage(fromIP, { type: 'peer', msg: message });
  
  // Return any responses that need to be sent back
  return responses;
}

// Simulate the entire interaction
function simulateInteraction() {
  timeLog('=== Starting VM Interaction Simulation ===');
  
  // Initialize sessions
  timeLog('Initializing sessions...');
  solverVM.processMessage(TRADER_IP, { type: 'init' });
  traderVM.processMessage(SOLVER_IP, { type: 'init' });
  
  // Step 1: Trader initiates by requesting PPM template
  timeLog('\n=== Step 1: Trader requests PPM template ===');
  const traderInitResponses = traderVM.processMessage(SOLVER_IP, { type: 'peer', msg: {} });
  timeLog('Trader session state:', traderVM.sessions[SOLVER_IP]);
  
  // Step 2: Deliver trader's PPM template request to solver
  timeLog('\n=== Step 2: Solver receives PPM template request ===');
  const solverPPMTResponses = deliverMessage(
    traderVM, solverVM, 
    TRADER_IP, SOLVER_IP, 
    traderInitResponses[0].msg
  );
  timeLog('Solver session state:', solverVM.sessions[TRADER_IP]);
  
  // Step 3: Deliver solver's PPM template to trader
  timeLog('\n=== Step 3: Trader receives PPM template ===');
  const traderLogonResponses = deliverMessage(
    solverVM, traderVM,
    SOLVER_IP, TRADER_IP,
    solverPPMTResponses[0].msg
  );
  timeLog('Trader session state:', traderVM.sessions[SOLVER_IP]);
  
  // Step 4: Deliver trader's logon message to solver
  timeLog('\n=== Step 4: Solver receives trader logon ===');
  const solverLogonResponses = deliverMessage(
    traderVM, solverVM,
    TRADER_IP, SOLVER_IP,
    traderLogonResponses[0].msg
  );
  timeLog('Solver session state:', solverVM.sessions[TRADER_IP]);
  
  // Step 5: Deliver solver's logon response to trader
  timeLog('\n=== Step 5: Trader receives solver logon ===');
  const traderFinalResponses = deliverMessage(
    solverVM, traderVM,
    SOLVER_IP, TRADER_IP,
    solverLogonResponses[0].msg
  );
  timeLog('Trader session state:', traderVM.sessions[SOLVER_IP]);
  
  // Final state check
  timeLog('\n=== Final Session States ===');
  timeLog('Trader session:', traderVM.sessions[SOLVER_IP]);
  timeLog('Solver session:', solverVM.sessions[TRADER_IP]);
  
  // Verify both VMs are in TRADE phase
  const traderPhase = traderVM.sessions[SOLVER_IP].phase;
  const solverPhase = solverVM.sessions[TRADER_IP].phase;
  
  timeLog(`\nTrader phase: ${traderPhase}`);
  timeLog(`Solver phase: ${solverPhase}`);
  
  if (traderPhase === 'TRADE' && solverPhase === 'TRADE') {
    timeLog('\n✅ SUCCESS: Both VMs successfully transitioned to TRADE phase');
    timeLog('Connection established with exchanged keys and guardian information');
  } else {
    timeLog('\n❌ ERROR: VMs failed to reach TRADE phase');
  }
}

// Run the simulation
simulateInteraction();
