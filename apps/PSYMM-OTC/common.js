const fs = require("fs");
const path = require("path");
const { createPublicClient, http } = require("viem");

/**
 * Reads contract addresses from the contracts.tmp.json file
 * @returns {Object} The contract addresses and other configuration
 */
function getContractAddresses() {
  try {
    // Assuming the contracts.tmp.json is in the project root
    const contractsPath = path.resolve(process.cwd(), "contracts.tmp.json");
    const contractsData = fs.readFileSync(contractsPath, "utf8");
    return JSON.parse(contractsData);
  } catch (error) {
    console.error("Error reading contracts.tmp.json:", error);
    throw new Error("Failed to load contract addresses");
  }
}

/**
 * Gets all PartyRegistered events that occurred before a specific block
 * @param {Object} options - Configuration options
 * @param {string} options.rpcUrl - The RPC URL to connect to
 * @param {string} options.partyRegistryAddress - The PartyRegistry contract address
 * @param {number} options.beforeBlock - Get events before this block number (optional)
 * @param {number} options.fromBlock - Get events from this block number (optional, defaults to 0)
 * @returns {Promise<Array>} Array of PartyRegistered events
 */
async function getPartyRegisteredEvents({
  rpcUrl,
  partyRegistryAddress,
  beforeBlock = "latest",
  fromBlock = 0n,
}) {
  // Create a public client with the provided RPC URL
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  // Define the ABI for the PartyRegistered event
  const partyRegisteredEventAbi = {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "party",
        type: "address",
      },
      {
        indexed: false,
        name: "ipAddress",
        type: "string",
      },
    ],
    name: "PartyRegistered",
    type: "event",
  };

  try {
    // Get logs for the PartyRegistered event
    const logs = await publicClient.getLogs({
      address: partyRegistryAddress,
      event: partyRegisteredEventAbi,
      fromBlock,
      toBlock: beforeBlock,
    });

    // Process and return the events
    return logs.map((log) => ({
      party: log.args.party,
      ipAddress: log.args.ipAddress,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    }));
  } catch (error) {
    console.error("Error fetching PartyRegistered events:", error);
    throw new Error("Failed to fetch PartyRegistered events");
  }
}

/**
 * Prints all registered parties to the console
 * @param {string} rpcUrl - The RPC URL to connect to
 */
async function printAllRegisteredParties(rpcUrl = "http://localhost:8545") {
  try {
    const contractAddresses = getContractAddresses();

    if (!contractAddresses.partyRegistry) {
      console.error("Party Registry address not found in contracts.tmp.json");
      return;
    }

    console.log(
      "Fetching registered parties from PartyRegistry at:",
      contractAddresses.partyRegistry
    );

    const parties = await getPartyRegisteredEvents({
      rpcUrl,
      partyRegistryAddress: contractAddresses.partyRegistry,
    });

    if (parties.length === 0) {
      console.log("No registered parties found.");
      return;
    }

    console.log("\nRegistered Parties:");
    console.log("===================");

    parties.forEach((party, index) => {
      console.log(`Party #${index + 1}:`);
      console.log(`  Address: ${party.party}`);
      console.log(`  IP Address: ${party.ipAddress}`);
      console.log(`  Registered in block: ${party.blockNumber}`);
      console.log(`  Transaction: ${party.transactionHash}`);
      console.log("-------------------");
    });
  } catch (error) {
    console.error("Error printing registered parties:", error);
  }
}

module.exports = {
  getContractAddresses,
  getPartyRegisteredEvents,
  printAllRegisteredParties,
};

// If this file is being run directly, print all registered parties
if (require.main === module) {
  // Default to localhost:8545 if no RPC URL is provided
  const rpcUrl = process.argv[2] || "http://localhost:8545";
  printAllRegisteredParties(rpcUrl)
    .then(() => console.log("Done!"))
    .catch((err) => console.error("Error:", err));
}
