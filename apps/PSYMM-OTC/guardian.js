import { WebSocketServer } from 'ws';
import { signMessage } from "@fundmaker/schnorr";
import { keyFromSeed } from "./common.js";
import { Queue } from "./queue.js";

export class GuardianServer {
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

    // Queues
    this.inputQueue = new Queue();
    this.outputQueue = new Queue();

    // Session state storage
    this.sessions = new Map(); // custodyId => session data
    this.messageHistory = new Map(); // custodyId => array of messages

    // Server instance
    this.server = null;
    this.clients = new Map(); // clientId => websocket connection
    this.nextClientId = 1;

    if (!this.privateKey || !this.publicKey) {
      throw new Error(
        "Guardian requires either seed or privateKey/publicKey configuration"
      );
    }
  }

  initServer() {
    this.server = new WebSocketServer({
      host: this.host,
      port: this.port,
    });

    console.log(
      `Guardian WebSocket server started on ${this.host}:${this.port}`
    );

    this.server.on("connection", (ws, req) => {
      const clientId = this.nextClientId++;
      const clientIp = req.socket.remoteAddress;
      console.log(`New client connected: ${clientId} from IP: ${clientIp}`);

      this.clients.set(clientId, ws);

      ws.on("message", (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.inputQueue.push({
            clientId,
            message: parsedMessage,
          });
        } catch (error) {
          console.error(`Error parsing message from ${clientId}:`, error);
        }
      });

      ws.on("close", () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on("error", (error) => {
        console.error(`Error with client ${clientId}:`, error);
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

      // Push ACK to output queue
      this.outputQueue.push({
        message: signedAck,
      });

      this.sessions.set(custodyId, session);
    }
  }

  async handleInputQueue() {
    await this.inputQueue.waitForUpdate();

    while (this.inputQueue.length > 0) {
      const { clientId, message } = this.inputQueue.shift();
      this.handleMessage(message);
    }
  }

  async handleOutputQueue() {
    await this.outputQueue.waitForUpdate();

    while (this.outputQueue.length > 0) {
      const { message } = this.outputQueue.shift();
      const signedMessage = this.signMessage(message);
      const messageStr = JSON.stringify(signedMessage);

      // Send to all connected clients
      this.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  startQueueHandlers() {
    // Start input and output queue handlers
    this.startHandler(this.handleInputQueue.bind(this), "InputQueue");
    this.startHandler(this.handleOutputQueue.bind(this), "OutputQueue");
  }

  startHandler(handlerFn, name) {
    const runHandler = async () => {
      try {
        while (true) {
          await handlerFn();
        }
      } catch (error) {
        console.error(`Error in ${name} handler:`, error);
        // Restart handler after delay
        setTimeout(() => this.startHandler(handlerFn, name), 1000);
      }
    };
    runHandler();
  }

  start() {
    this.initServer();
    this.startQueueHandlers();
    console.log("Guardian server running. Press Ctrl+C to exit.");
    console.log(this.publicKey);
  }
}

function main() {
  const host = process.argv[2] || "127.0.0.1";
  const seed = parseInt(process.argv[3]);
  const guardian = new GuardianServer({ host, seed });
  guardian.start();
}
main();
