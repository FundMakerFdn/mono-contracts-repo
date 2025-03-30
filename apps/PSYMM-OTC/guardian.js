const WebSocket = require("ws");
const { signMessage } = require("@fundmaker/schnorr");
const { keyFromSeed } = require("./common");

class GuardianServer {
  constructor(config = {}) {
    // Server configuration
    this.host = config.host || "127.0.0.1";
    this.port = config.port || 8080;

    // Generate keys from seed if provided, otherwise use config
    if (config.seed !== undefined) {
      const keys = keyFromSeed(config.seed);
      this.privateKey = keys.privKey;
      this.publicKey = keys.pubKey;
    } else {
      this.privateKey = config.privateKey;
      this.publicKey = config.publicKey;
    }

    // Session state storage
    this.sessions = new Map(); // custodyId => session data
    this.messageHistory = new Map(); // custodyId => array of messages

    // Server instance
    this.server = null;

    if (!this.privateKey || !this.publicKey) {
      throw new Error(
        "Guardian requires either seed or privateKey/publicKey configuration"
      );
    }
  }

  initServer() {
    this.server = new WebSocket.Server({
      host: this.host,
      port: this.port,
    });

    console.log(
      `Guardian WebSocket server started on ${this.host}:${this.port}`
    );

    this.server.on("connection", (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`New client connected from IP: ${clientIp}`);

      ws.on("message", (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.handleMessage(parsedMessage);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      });

      ws.on("close", () => {
        console.log(`Client disconnected from IP: ${clientIp}`);
      });

      ws.on("error", (error) => {
        console.error(`WebSocket error:`, error);
      });
    });
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
    const signature = signMessage(msgBytes, this.privateKey);

    // Add signature components to StandardTrailer
    message.StandardTrailer.PublicKey = this.publicKey;
    message.StandardTrailer.Signature = {
      s: signature.s.toString(),
      e: signature.challenge.toString(),
    };

    return message;
  }

  handleMessage(message) {
    // Log only message type and sequence number
    console.log("Received message type ", message?.StandardHeader?.MsgType);

    // Extract custody ID and sequence number if present
    const custodyId = message?.StandardHeader?.CustodyID;
    const incomingSeqNum = message?.StandardHeader?.MsgSeqNum;
    const senderCompId = message?.StandardHeader?.SenderCompID;

    if (custodyId) {
      // Store message in history
      if (!this.messageHistory.has(custodyId)) {
        this.messageHistory.set(custodyId, []);
      }
      this.messageHistory.get(custodyId).push({
        timestamp: Date.now(),
        message,
      });

      // Update session state if needed
      if (!this.sessions.has(custodyId)) {
        this.sessions.set(custodyId, {
          lastSeen: Date.now(),
          messageCount: 0,
          seqNum: 1,
        });
      }

      const session = this.sessions.get(custodyId);
      session.lastSeen = Date.now();
      session.messageCount++;

      // Create ACK message
      const ackMessage = {
        StandardHeader: {
          BeginString: "pSymm.FIX.2.0",
          MsgType: "ACK",
          SenderCompID: this.publicKey,
          TargetCompID: senderCompId,
          MsgSeqNum: session.seqNum++,
          RefMsgSeqNum: incomingSeqNum,
          CustodyID: custodyId,
          SendingTime: (Date.now() * 1000000).toString(),
        },
      };

      // Sign the ACK message
      const signedAck = this.signMessage(ackMessage);

      // Send ACK to all connected clients
      this.server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          console.log("Sending ACK:", signedAck);
          client.send(JSON.stringify(signedAck));
        }
      });

      this.sessions.set(custodyId, session);
    }
  }

  start() {
    this.initServer();
    console.log("Guardian server running. Press Ctrl+C to exit.");
    console.log(this.publicKey);
  }
}

// Run the guardian if this file is executed directly
if (require.main === module) {
  const host = process.argv[2] || "127.0.0.1";
  const seed = parseInt(process.argv[3]);
  const guardian = new GuardianServer({ host, seed });
  guardian.start();
}

module.exports = { GuardianServer };
