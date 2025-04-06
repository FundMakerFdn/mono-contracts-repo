import { pSymmServer } from './engine.js';
import { keyFromSeed } from './common.js';
import custody from './otcVM.js';

const HOST = "127.0.0.1"; // host on
const PORT = 8080;
const { privKey: SOLVER_PRIVKEY, pubKey: SOLVER_PUBKEY } = keyFromSeed(0);
const { pubKey: GUARDIAN_PUBKEY } = keyFromSeed(2); // Guardian for solver

/**
 * Main solver function
 */
async function runSolver() {
  // Start the pSymmServer server
  console.log("Starting pSymmServer solver...");
  const party = new pSymmServer({
    host: HOST,
    port: PORT,
    privKey: SOLVER_PRIVKEY,
    pubKey: SOLVER_PUBKEY, // can be derived from privKey
    guardianPubKeys: [GUARDIAN_PUBKEY],
    ppmTemplate: custody,
    role: "solver",
  });

  // Start the server
  const serverPromise = party.run().catch((err) => {
    console.error("Server error:", err);
  });

  console.log("Solver running. Press Ctrl+C to exit.");
  return serverPromise;
}

// Run the solver if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  runSolver();
}

export { runSolver };
