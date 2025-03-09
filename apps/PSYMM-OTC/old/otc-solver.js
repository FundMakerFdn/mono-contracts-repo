const { SolverEngine, timeLog } = require("./engine");
const { getContractAddresses, getPartyRegisteredEvents } = require("./common");
const { secp256k1 } = require("@noble/curves/secp256k1");
const { bytesToHex } = require("viem");
const schnorr = require("@fundmaker/schnorr");

// OTC Solver implementation
class OTCSolver extends SolverEngine {
  constructor(
    host = "127.0.0.2",
    port = 8080,
    rpcUrl = "http://localhost:8545"
  ) {
    super(host, port);
    this.rpcUrl = rpcUrl;
    this.clientParties = new Map(); // clientId -> party info
    this.contractAddresses = getContractAddresses();

    // Generate Schnorr key pair
    this.privateKey = BigInt(bytesToHex(secp256k1.utils.randomPrivateKey()));
    this.publicKey = secp256k1.ProjectivePoint.BASE.multiply(this.privateKey);

    timeLog("Generated Schnorr key pair");
  }

  // Override the onClientConnect hook
  async onClientConnect(clientId, clientIp) {
    // Initialize client state with OTC-specific fields
    this.clientState.set(clientId, {
      publicKey: null, // Will store client's public key
    });

    // Look up the party in the registry by IP address
    try {
      const parties = await getPartyRegisteredEvents({
        rpcUrl: this.rpcUrl,
        partyRegistryAddress: this.contractAddresses.partyRegistry,
      });

      // Find parties with matching IP address
      const matchingParties = parties.filter(
        (party) => party.ipAddress === clientIp
      );

      if (matchingParties.length > 0) {
        this.clientParties.set(clientId, matchingParties);
        timeLog(
          `Found ${matchingParties.length} matching parties in registry for IP ${clientIp}:`
        );
        matchingParties.forEach((party, index) => {
          timeLog(`  Party #${index + 1}:`);
          timeLog(`    Address: ${party.party}`);
          timeLog(`    Role: ${party.role}`);
          timeLog(`    Registered in block: ${party.blockNumber}`);
        });
      } else {
        timeLog(`No matching parties found in registry for IP ${clientIp}`);
      }
    } catch (error) {
      timeLog(`Error looking up party in registry: ${error.message}`);
    }
  }

  // Override the onClientDisconnect hook
  onClientDisconnect(clientId) {
    this.clientParties.delete(clientId);
  }

  // Override the processMessage method to handle OTC-specific messages
  async processMessage(clientId, message) {
    // Handle key exchange message
    if (message.type === "key_exchange" && message.publicKey) {
      timeLog(`Received client's public key: ${message.publicKey}`);
      const clientState = this.clientState.get(clientId);
      clientState.publicKey = secp256k1.ProjectivePoint.fromHex(
        message.publicKey.replace("0x", "")
      );
      this.clientState.set(clientId, clientState);
      timeLog(`Stored client's public key in state for ${clientId}`);

      // Send our public key back to the client
      const pubKeyHex = bytesToHex(this.publicKey.toRawBytes(true));
      timeLog(`Sending solver's public key to client: ${pubKeyHex}`);

      this.outputQueue.push({
        clientId,
        message: { type: "key_exchange", publicKey: pubKeyHex },
      });

      // Create a "hello world" message and sign it
      const msgBytes = new TextEncoder().encode("hello world");
      const signature = schnorr.signMessage(msgBytes, this.privateKey);

      // Send key exchange response with signature
      const keyExchangeResponse = {
        type: "ack",
        publicKey: pubKeyHex,
        signature: {
          s: signature.s.toString(),
          challenge: signature.challenge.toString(),
        },
      };

      // Add to output queue
      this.outputQueue.push({
        clientId,
        message: keyExchangeResponse,
      });

      // If client sent a signature verification result, log it
      if (message.verificationResult !== undefined) {
        timeLog(
          `Client ${clientId} signature verification result: ${message.verificationResult}`
        );
        timeLog(
          `Verification details: ${
            message.verificationDetails || "No details provided"
          }`
        );
      }
    }
  }
}

// Start the OTC solver if this file is run directly
if (require.main === module) {
  const port = process.env.PORT || 8080;
  const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
  const solver = new OTCSolver("127.0.0.2", port, rpcUrl);

  solver.run().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { OTCSolver };
