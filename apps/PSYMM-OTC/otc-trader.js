const WebSocket = require("ws");
const { getContractAddresses, getPartyRegisteredEvents } = require("./common");

// Time logging utility
const timeLog = (...args) =>
  console.log(`${Math.ceil(process.uptime() * 1000)}ms\t`, ...args);

/**
 * OTC Trader client that connects to a Solver
 */
class OTCTrader {
  constructor(rpcUrl = "http://localhost:8545") {
    this.rpcUrl = rpcUrl;
    this.contractAddresses = getContractAddresses();
    this.ws = null;
  }

  /**
   * Find all registered Solvers
   * @returns {Promise<Array>} Array of Solver parties
   */
  async findSolvers() {
    try {
      timeLog("Looking for registered Solvers...");

      const parties = await getPartyRegisteredEvents({
        rpcUrl: this.rpcUrl,
        partyRegistryAddress: this.contractAddresses.partyRegistry,
      });

      // Filter for parties with the "Solver" role
      const solvers = parties.filter((party) => party.role === "Solver");

      if (solvers.length === 0) {
        timeLog("No Solvers found in the registry");
        return [];
      }

      timeLog(`Found ${solvers.length} Solvers:`);
      solvers.forEach((solver, index) => {
        timeLog(`  Solver #${index + 1}:`);
        timeLog(`    Address: ${solver.party}`);
        timeLog(`    IP Address: ${solver.ipAddress}`);
        timeLog(`    Registered in block: ${solver.blockNumber}`);
      });

      return solvers;
    } catch (error) {
      timeLog(`Error finding Solvers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to a Solver
   * @param {Object} solver - The Solver party to connect to
   * @returns {Promise<void>}
   */
  async connectToSolver(solver) {
    return new Promise((resolve, reject) => {
      try {
        const url = `ws://${solver.ipAddress}:8080`;
        timeLog(`Connecting to Solver at ${url}...`);

        this.ws = new WebSocket(url);

        this.ws.on("open", () => {
          timeLog(`Connected to Solver at ${url}`);
          resolve();
        });

        this.ws.on("message", (data) => {
          try {
            const message = JSON.parse(data);
            timeLog("Received message from Solver:");
            console.log(JSON.stringify(message, null, 2));
          } catch (error) {
            timeLog(`Error parsing message: ${error.message}`);
          }
        });

        this.ws.on("error", (error) => {
          timeLog(`WebSocket error: ${error.message}`);
          reject(error);
        });

        this.ws.on("close", () => {
          timeLog("Connection to Solver closed");
        });
      } catch (error) {
        timeLog(`Error connecting to Solver: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Send a message to the connected Solver
   * @param {Object} message - The message to send
   */
  sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      timeLog("Not connected to a Solver");
      return;
    }

    timeLog("Sending message to Solver:");
    console.log(JSON.stringify(message, null, 2));

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Close the connection to the Solver
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      timeLog("Disconnected from Solver");
    }
  }
}

/**
 * Main function to run the OTC Trader
 */
async function main() {
  const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
  const trader = new OTCTrader(rpcUrl);

  try {
    // Find all Solvers
    const solvers = await trader.findSolvers();

    if (solvers.length === 0) {
      timeLog("No Solvers found. Exiting.");
      process.exit(0);
    }

    // Choose the first Solver
    const chosenSolver = solvers[0];
    timeLog(
      `Choosing Solver: ${chosenSolver.party} at ${chosenSolver.ipAddress}`
    );

    // Connect to the chosen Solver
    await trader.connectToSolver(chosenSolver);

    // Send a hello world message
    trader.sendMessage({ hello: "world" });

    // Keep the connection open for a while to receive responses
    timeLog("Waiting for responses...");
    setTimeout(() => {
      trader.disconnect();
      timeLog("Done!");
      process.exit(0);
    }, 5000);
  } catch (error) {
    timeLog(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Start the OTC trader if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { OTCTrader };
