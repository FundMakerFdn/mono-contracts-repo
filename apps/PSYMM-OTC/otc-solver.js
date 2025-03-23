const { pSymmServer } = require("./engine");
const { keyFromSeed } = require("./common");

const HOST = "127.0.0.1"; // host on
const PORT = 8080;
const { privKey: SOLVER_PRIVKEY, pubKey: SOLVER_PUBKEY } = keyFromSeed(0);
const GUARDIANS = [keyFromSeed(1).pubKey];

/**
 * Main solver function
 */
async function runSolver() {
  // Start the pSymmServer server
  console.log("Starting pSymmServer solver...");
  const custody = require("./otcVM");
  const party = new pSymmServer({
    host: HOST,
    port: PORT,
    privKey: SOLVER_PRIVKEY,
    pubKey: SOLVER_PUBKEY, // can be derived from privKey
    guardianPubKeys: GUARDIANS,
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
if (require.main === module) {
  runSolver();
}

module.exports = { runSolver };
