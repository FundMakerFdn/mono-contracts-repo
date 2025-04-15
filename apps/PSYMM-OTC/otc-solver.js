import { pSymmServer } from './engine.js';
import { keyFromSeed } from './common.js';
import custody from './otcVM.js';
import { MsgBuilder } from '@fundmaker/pSymmFIX';

const HOST = "127.0.0.1"; // host on
const PORT = 8080;
const { privKey: SOLVER_PRIVKEY, pubKey: SOLVER_PUBKEY } = keyFromSeed(0);

/**
 * Main solver function
 */
async function runSolver() {
  // Create message builder instance
  const msgBuilder = new MsgBuilder({
    senderCompID: SOLVER_PUBKEY,
    privateKey: SOLVER_PRIVKEY
  });

  // Start the pSymmServer server
  console.log("Starting pSymmServer solver...");
  const party = new pSymmServer({
    host: HOST,
    port: PORT,
    privKey: SOLVER_PRIVKEY,
    pubKey: SOLVER_PUBKEY,
    ppmTemplate: custody,
    role: "solver",
    msgBuilder: msgBuilder // Pass the message builder instance
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
