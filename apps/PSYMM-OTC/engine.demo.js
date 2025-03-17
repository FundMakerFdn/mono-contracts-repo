const WebSocket = require("ws");
const { pSymmParty } = require("./engine");

// Configuration
const HOST = "127.0.0.1";
const PORT = 8080;
const DEMO_TRADER_PUBKEY = "0xTraderPubKey123";

/**
 * Demo client that connects to pSymmParty and progresses through protocol phases
 */
class DemoClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.phase = "DISCONNECTED";
    this.msgSeqNum = 1;
  }

  connect() {
    console.log(`Connecting to ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log("Connected to server");
      this.connected = true;
      this.phase = "CONNECTED";

      // Start the protocol flow after a short delay
      setTimeout(() => this.sendPPMTR(), 1000);
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
      this.phase = "PKXCHG";
      setTimeout(() => this.sendLogon(), 1000);
    } else if (msgType === "A") {
      console.log("Received Logon response, now in TRADE phase!");
      this.phase = "TRADE";

      // Now we can start sending trade messages
      setTimeout(() => this.sendTradeMessage(), 1000);
    }
  }

  sendPPMTR() {
    if (!this.connected) return;

    console.log("Sending PPMTR (PPM Template Request)...");

    const ppmtrMessage = {
      message: {
        StandardHeader: {
          BeginString: "pSymm.FIX.2.0",
          MsgType: "PPMTR",
          DeploymentID: 101,
          SenderCompID: DEMO_TRADER_PUBKEY,
          TargetCompID: "SOLVER",
          MsgSeqNum: this.msgSeqNum++,
          SendingTime: (Date.now() * 1000000).toString(),
        },
        StandardTrailer: {
          PublicKey: DEMO_TRADER_PUBKEY,
          Signature: "0xDemoSignature",
        },
      },
    };

    this.ws.send(JSON.stringify(ppmtrMessage));
    this.phase = "INIT";
  }

  sendLogon() {
    if (!this.connected) return;

    console.log("Sending Logon message...");

    const logonMessage = {
      message: {
        StandardHeader: {
          BeginString: "pSymm.FIX.2.0",
          MsgType: "A",
          DeploymentID: 101,
          SenderCompID: DEMO_TRADER_PUBKEY,
          TargetCompID: "SOLVER",
          MsgSeqNum: this.msgSeqNum++,
          CustodyID: "0xDemoCustody123",
          SendingTime: (Date.now() * 1000000).toString(),
        },
        HeartBtInt: 10,
        GuardianIP: "192.168.1.100",
        StandardTrailer: {
          PublicKey: DEMO_TRADER_PUBKEY,
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
          DeploymentID: 101,
          SenderCompID: DEMO_TRADER_PUBKEY,
          TargetCompID: "SOLVER",
          MsgSeqNum: this.msgSeqNum++,
          CustodyID: "0xDemoCustody123",
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
          PublicKey: DEMO_TRADER_PUBKEY,
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
 * Main demo function
 */
async function runDemo() {
  // Start the pSymmParty server
  console.log("Starting pSymmParty server...");
  const custody = require("./otcVM");
  const party = new pSymmParty({
    host: HOST,
    port: PORT,
    pubKey: "SOLVER",
    ppmTemplate: custody.parties,
  });

  // Start the server in the background
  const serverPromise = party.run().catch((err) => {
    console.error("Server error:", err);
  });

  // Give the server a moment to start up
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Create and connect a demo client
  const client = new DemoClient(`ws://${HOST}:${PORT}`);
  client.connect();

  // Keep the demo running for a while
  console.log("Demo running. Press Ctrl+C to exit.");
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { DemoClient, runDemo };
