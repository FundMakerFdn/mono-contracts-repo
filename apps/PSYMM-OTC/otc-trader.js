const { keyFromSeed, getContractAddresses, getGuardianData } = require("./common");
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
    this.custodyId = "0x0000000000000000000000000000000000000000000000000000000000000001";
    
    // Configuration
    this.rpcUrl = config.rpcUrl || "http://localhost:8545";
    this.contractAddresses = getContractAddresses();
    this.guardianPubKeys = [GUARDIAN_PUBKEY];
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
      this.guardianConnection = new WebSocket(`ws://${guardian.ipAddress}:8080`);
      
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
      this.phase = "TRADE";

      // Now we can start sending trade messages
      setTimeout(() => this.sendTradeMessage(), 1000);
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
    if (this.guardianConnection && this.guardianConnection.readyState === WebSocket.OPEN) {
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
    if (this.guardianConnection && this.guardianConnection.readyState === WebSocket.OPEN) {
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

    // Send to guardian
    if (this.guardianConnection && this.guardianConnection.readyState === WebSocket.OPEN) {
      this.guardianConnection.send(messageStr);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * Main trader function
 */
async function runTrader() {
  // Create and connect a trader client
  const client = new TraderClient({
    url: `ws://${HOST}:${PORT}`,
    rpcUrl: "http://localhost:8545"
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
