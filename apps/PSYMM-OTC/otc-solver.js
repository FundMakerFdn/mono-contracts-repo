const { pSymmServer } = require("./engine");

// Configuration
const HOST = "127.0.0.1";
const PORT = 8080;
const SOLVER_PUBKEY = "0xSolverPubKey";

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
    pubKey: SOLVER_PUBKEY,
    guardianPubKeys: ["0xSolverGuardian1"],
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
