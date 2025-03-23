const WebSocket = require("ws");

class GuardianServer {
  constructor(config = {}) {
    // Server configuration
    this.host = config.host || "127.0.0.1";
    this.port = config.port || 8080;

    // Session state storage
    this.sessions = new Map(); // custodyId => session data
    this.messageHistory = new Map(); // custodyId => array of messages

    // Server instance
    this.server = null;
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

  handleMessage(message) {
    // Log all messages
    console.log("Received message:", JSON.stringify(message, null, 2));

    // Extract custody ID if present
    const custodyId = message?.StandardHeader?.CustodyID;

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
          // Add other session state as needed
        });
      }

      const session = this.sessions.get(custodyId);
      session.lastSeen = Date.now();
      session.messageCount++;
      this.sessions.set(custodyId, session);
    }
  }

  start() {
    this.initServer();
    console.log("Guardian server running. Press Ctrl+C to exit.");
  }
}

// Run the guardian if this file is executed directly
if (require.main === module) {
  const host = process.argv[2] || "127.0.0.1";
  const guardian = new GuardianServer({ host });
  guardian.start();
}

module.exports = { GuardianServer };
