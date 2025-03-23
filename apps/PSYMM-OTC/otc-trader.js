const WebSocket = require("ws");

// Configuration
const HOST = "127.0.0.1";
const PORT = 8080;
const TRADER_PUBKEY = "0xTraderPubKey";
const SOLVER_PUBKEY = "0xSolverPubKey";

/**
 * Trader client that connects to pSymmServer and progresses through protocol phases
 */
class TraderClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.phase = "DISCONNECTED";
    this.msgSeqNum = 1;
    this.custodyId = "0xDemoCustody123";
  }

  connect() {
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

  sendPPMH() {
    if (!this.connected) return;

    console.log("Sending PPMH (PPM Handshake)...");

    const ppmhMessage = {
      message: {
        StandardHeader: {
          BeginString: "pSymm.FIX.2.0",
          MsgType: "PPMH",
          SenderCompID: TRADER_PUBKEY,
          TargetCompID: SOLVER_PUBKEY,
          MsgSeqNum: this.msgSeqNum++,
          SendingTime: (Date.now() * 1000000).toString(),
        },
        StandardTrailer: {
          PublicKey: TRADER_PUBKEY,
          Signature: "0xDemoSignature",
        },
      },
    };

    this.ws.send(JSON.stringify(ppmhMessage));
  }

  sendLogon() {
    if (!this.connected) return;

    console.log("Sending Logon message...");

    const logonMessage = {
      message: {
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
        GuardianPubKeys: ["0xTraderGuardian1"],
        StandardTrailer: {
          PublicKey: TRADER_PUBKEY,
          Signature: "0xDemoSignature",
        },
      },
    };

    this.ws.send(JSON.stringify(logonMessage));
  }

  sendTradeMessage() {
    if (!this.connected || this.phase !== "TRADE") return;

    console.log("Sending a sample trade message...");

    // This is just a placeholder trade message
    const tradeMessage = {
      message: {
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
        StandardTrailer: {
          PublicKey: TRADER_PUBKEY,
          Signature: "0xDemoSignature",
        },
      },
    };

    this.ws.send(JSON.stringify(tradeMessage));
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
  const client = new TraderClient(`ws://${HOST}:${PORT}`);
  client.connect();

  // Keep the demo running for a while
  console.log("Trader client running. Press Ctrl+C to exit.");
}

// Run the trader if this file is executed directly
if (require.main === module) {
  runTrader();
}

module.exports = { TraderClient, runTrader };
