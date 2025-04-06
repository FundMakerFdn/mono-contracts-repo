const { keyFromSeed, getGuardianData } = require("./common");
const { getContractAddresses } = require("@fundmaker/pSymmFIX");
const WebSocket = require("ws");
const { signMessage } = require("@fundmaker/schnorr");

const HOST = "127.0.0.1"; // connect to
const PORT = 8080;
const { privKey: TRADER_PRIVKEY, pubKey: TRADER_PUBKEY } = keyFromSeed(1);
const SOLVER_PUBKEY = keyFromSeed(0).pubKey;
const { pubKey: GUARDIAN_PUBKEY } = keyFromSeed(3); // Guardian for trader

/**
 * Trader client that connects to pSymmServer and progresses through protocol phases
 */
class TraderClient {
  constructor(config = {}) {
    this.url = config.url;
    this.ws = null;
    this.guardianConnection = null;
    this.connected = false;
    this.phase = "DISCONNECTED";
    this.msgSeqNum = 1;
    this.custodyId =
      "0x0000000000000000000000000000000000000000000000000000000000000001";

    // Configuration
    this.rpcUrl = config.rpcUrl || "http://localhost:8545";
    this.contractAddresses = getContractAddresses();
    this.guardianPubKeys = [GUARDIAN_PUBKEY];
    this.counterpartyGuardianConnections = new Map();
  }

  async connectToGuardians() {
    try {
      const guardianData = await getGuardianData({
        rpcUrl: this.rpcUrl,
        partyRegistryAddress: this.contractAddresses.partyRegistry,
        myGuardianPubKeys: this.guardianPubKeys,
      });

      if (!guardianData.length) {
        throw new Error("Guardian not found");
      }

      const guardian = guardianData[0];
      this.guardianConnection = new WebSocket(
        `ws://${guardian.ipAddress}:8080`
      );

      await new Promise((resolve, reject) => {
        this.guardianConnection.on("open", resolve);
        this.guardianConnection.on("error", reject);
      });

      console.log(`Connected to guardian at ${guardian.ipAddress}`);

      this.guardianConnection.on("message", (data) => {
        try {
          const message = JSON.parse(data);
          console.log("Received message from guardian:", message);
        } catch (error) {
          console.error("Error parsing guardian message:", error);
        }
      });
    } catch (error) {
      console.log(`Guardian connection error: ${error.message}`);
      throw error;
    }
  }

  async connect() {
    // First connect to guardian
    await this.connectToGuardians();
    console.log(`Connecting to ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log("Connected to server");
      this.connected = true;
      this.phase = "CONNECTED";

      // Start by sending PPMH after a short delay
      setTimeout(() => this.sendPPMH(), 1000);
    });

    this.ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        console.log("Received message:", JSON.stringify(message, null, 2));

        this.handleServerMessage(message);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });

    this.ws.on("close", () => {
      console.log("Disconnected from server");
      this.connected = false;
      this.phase = "DISCONNECTED";
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  }

  handleServerMessage(message) {
    // Check message type from StandardHeader if available
    const msgType = message?.StandardHeader?.MsgType;

    if (msgType === "PPMT") {
      console.log("Received PPM Template, sending Logon...");
      setTimeout(() => this.sendLogon(), 1000);
    } else if (msgType === "A") {
      console.log("Received Logon response, now in TRADE phase!");
      // Connect to counterparty guardians if they were provided
      if (message.GuardianPubKeys && message.GuardianPubKeys.length > 0) {
        this.connectToCounterpartyGuardians(message.GuardianPubKeys)
          .then(() => {
            this.phase = "TRADE";
            // Send trade message after guardian connections are established
            setTimeout(() => this.sendTradeMessage(), 1000);
          })
          .catch((error) => {
            console.error(
              "Failed to connect to counterparty guardians:",
              error
            );
          });
      } else {
        this.phase = "TRADE";
        setTimeout(() => this.sendTradeMessage(), 1000);
      }
    }
  }

  async connectToCounterpartyGuardians(guardianPubKeys) {
    try {
      // Get guardian data for all counterparty guardian public keys
      const guardianPromises = guardianPubKeys.map((pubKey) =>
        getGuardianData({
          rpcUrl: this.rpcUrl,
          partyRegistryAddress: this.contractAddresses.partyRegistry,
          myGuardianPubKeys: [pubKey],
        })
      );

      const guardiansData = await Promise.all(guardianPromises);

      // Connect to each guardian
      for (let i = 0; i < guardiansData.length; i++) {
        const guardianData = guardiansData[i][0]; // Take first result for each guardian
        if (!guardianData) {
          console.log(`Guardian not found for pubKey: ${guardianPubKeys[i]}`);
          continue;
        }

        const guardianPubKey = guardianPubKeys[i];
        const ws = new WebSocket(`ws://${guardianData.ipAddress}:8080`);

        // Set up connection handlers
        ws.on("open", () => {
          console.log(
            `Connected to counterparty guardian ${guardianPubKey} at ${guardianData.ipAddress}`
          );
        });

        ws.on("message", (data) => {
          try {
            const message = JSON.parse(data);
            console.log(
              `Received message from counterparty guardian ${guardianPubKey}:`,
              message
            );
          } catch (error) {
            console.error(
              `Error parsing message from counterparty guardian ${guardianPubKey}:`,
              error
            );
          }
        });

        ws.on("error", (error) => {
          console.log(
            `Error with counterparty guardian ${guardianPubKey}:`,
            error
          );
        });

        ws.on("close", () => {
          console.log(
            `Disconnected from counterparty guardian ${guardianPubKey}`
          );
          this.counterpartyGuardianConnections.delete(guardianPubKey);
        });

        // Wait for connection to establish
        await new Promise((resolve, reject) => {
          ws.once("open", resolve);
          ws.once("error", reject);
        });

        // Store the connection
        this.counterpartyGuardianConnections.set(guardianPubKey, ws);
      }
    } catch (error) {
      console.log(`Error connecting to counterparty guardians:`, error);
      throw error;
    }
  }

  signMessage(message) {
    // Ensure StandardTrailer exists
    if (!message.StandardTrailer) {
      message.StandardTrailer = {};
    }

    // Create a copy of the message without the signature for signing
    const msgCopy = JSON.parse(JSON.stringify(message));
    msgCopy.StandardTrailer = {}; // Empty trailer for signing

    // Convert message to bytes for signing
    const msgBytes = new TextEncoder().encode(JSON.stringify(msgCopy));

    // Sign the message using Schnorr
    const signature = signMessage(msgBytes, TRADER_PRIVKEY);

    // Add signature components to StandardTrailer - convert 0x02/0x03 format to y-coordinate
    message.StandardTrailer.PublicKey = TRADER_PUBKEY;
    message.StandardTrailer.Signature = {
      s: signature.s.toString(),
      e: signature.challenge.toString(),
    };

    return message;
  }

  sendPPMH() {
    if (!this.connected) return;

    console.log("Sending PPMH (PPM Handshake)...");

    let ppmhMessage = {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "PPMH",
        SenderCompID: TRADER_PUBKEY,
        TargetCompID: SOLVER_PUBKEY,
        MsgSeqNum: this.msgSeqNum++,
        SendingTime: (Date.now() * 1000000).toString(),
      },
    };

    // Sign the message
    ppmhMessage = this.signMessage(ppmhMessage);
    const messageStr = JSON.stringify(ppmhMessage);

    // Send to solver
    this.ws.send(messageStr);

    // Send to guardian
    if (
      this.guardianConnection &&
      this.guardianConnection.readyState === WebSocket.OPEN
    ) {
      this.guardianConnection.send(messageStr);
    }
  }

  sendLogon() {
    if (!this.connected) return;

    console.log("Sending Logon message...");

    let logonMessage = {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "A",
        SenderCompID: TRADER_PUBKEY,
        TargetCompID: SOLVER_PUBKEY,
        MsgSeqNum: this.msgSeqNum++,
        CustodyID: this.custodyId,
        SendingTime: (Date.now() * 1000000).toString(),
      },
      HeartBtInt: 10,
      GuardianPubKeys: [GUARDIAN_PUBKEY],
    };

    // Sign the message
    logonMessage = this.signMessage(logonMessage);

    const messageStr = JSON.stringify(logonMessage);

    // Send to solver
    this.ws.send(messageStr);

    // Send to guardian
    if (
      this.guardianConnection &&
      this.guardianConnection.readyState === WebSocket.OPEN
    ) {
      this.guardianConnection.send(messageStr);
    }
  }

  sendTradeMessage() {
    if (!this.connected || this.phase !== "TRADE") return;

    console.log("Sending a sample trade message...");

    // This is just a placeholder trade message
    let tradeMessage = {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "D", // New Order Single
        SenderCompID: TRADER_PUBKEY,
        TargetCompID: SOLVER_PUBKEY,
        MsgSeqNum: this.msgSeqNum++,
        CustodyID: this.custodyId,
        SendingTime: (Date.now() * 1000000).toString(),
      },
      ClOrdID: `order-${Date.now()}`,
      Symbol: "BTC/USD",
      Side: "1", // Buy
      OrderQty: "1.0",
      OrdType: "2", // Limit
      Price: "50000.00",
      TimeInForce: "1", // Good Till Cancel
    };

    // Sign the message
    tradeMessage = this.signMessage(tradeMessage);

    const messageStr = JSON.stringify(tradeMessage);

    // Send to solver
    this.ws.send(messageStr);

    // Send to our guardian
    if (
      this.guardianConnection &&
      this.guardianConnection.readyState === WebSocket.OPEN
    ) {
      this.guardianConnection.send(messageStr);
    }

    // Send to all counterparty guardians
    for (const [guardianPubKey, ws] of this.counterpartyGuardianConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(
          `Sending trade message to counterparty guardian ${guardianPubKey}`
        );
        ws.send(messageStr);
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.guardianConnection) {
      this.guardianConnection.close();
    }
    // Close all counterparty guardian connections
    for (const ws of this.counterpartyGuardianConnections.values()) {
      ws.close();
    }
    this.counterpartyGuardianConnections.clear();
  }
}

/**
 * Main trader function
 */
async function runTrader() {
  // Create and connect a trader client
  const client = new TraderClient({
    url: `ws://${HOST}:${PORT}`,
    rpcUrl: "http://localhost:8545",
  });

  await client.connect();

  // Keep the demo running for a while
  console.log("Trader client running. Press Ctrl+C to exit.");
}

// Run the trader if this file is executed directly
if (require.main === module) {
  runTrader();
}

module.exports = { TraderClient, runTrader };
