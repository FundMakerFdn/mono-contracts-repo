const WebSocket = require("ws");
const EventEmitter = require("events");
const { getContractAddresses, getPartyRegisteredEvents } = require("./common");

// Time logging utility
const timeLog = (...args) =>
  console.log(`${Math.ceil(process.uptime() * 1000)}ms\t`, ...args);

// Queue implementation
class Queue extends EventEmitter {
  constructor() {
    super();
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    this.emit("update", item);
  }

  async waitForUpdate() {
    return new Promise((resolve) => {
      this.once("update", resolve);
    });
  }

  shift() {
    return this.items.shift();
  }

  get length() {
    return this.items.length;
  }
}

// OTC Solver implementation
class OTCSolver {
  constructor(
    host = "127.0.0.2",
    port = 8080,
    rpcUrl = "http://localhost:8545"
  ) {
    this.host = host;
    this.port = port;
    this.rpcUrl = rpcUrl;
    this.inputQueue = new Queue();
    this.outputQueue = new Queue();
    this.clients = new Map(); // clientId -> websocket
    this.clientParties = new Map(); // clientId -> party info
    this.contractAddresses = getContractAddresses();
  }

  // Initialize WebSocket server
  initServer() {
    this.server = new WebSocket.Server({
      host: this.host,
      port: this.port,
    });

    timeLog(`WebSocket server started on ${this.host}:${this.port}`);

    this.server.on("connection", async (ws, req) => {
      const clientId = req.socket.remoteAddress + ":" + req.socket.remotePort;
      const clientIp = req.socket.remoteAddress;
      timeLog(`New client connected: ${clientId} from IP: ${clientIp}`);

      this.clients.set(clientId, ws);

      ws.on("message", (message) => {
        console.log(message);
        try {
          const parsedMessage = JSON.parse(message);
          timeLog(`Received message from ${clientId}:`, parsedMessage);

          this.inputQueue.push({
            clientId,
            message: parsedMessage,
          });
        } catch (error) {
          timeLog(`Error parsing message from ${clientId}:`, error);
        }
      });

      ws.on("close", () => {
        timeLog(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.clientParties.delete(clientId);
      });

      ws.on("error", (error) => {
        timeLog(`Error with client ${clientId}:`, error);
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
    });
  }

  // Process messages from input queue
  async handleInputQueue() {
    await this.inputQueue.waitForUpdate();

    while (this.inputQueue.length > 0) {
      const { clientId, message } = this.inputQueue.shift();
      timeLog(`Processing message from ${clientId}:`);
      console.log(JSON.stringify(message, null, 2));

      // Include party information if available
      if (this.clientParties.has(clientId)) {
        const parties = this.clientParties.get(clientId);
        timeLog(`Message is from registered party:`);
        parties.forEach((party, index) => {
          timeLog(`  Party #${index + 1}: ${party.party} (${party.role})`);
        });
      } else {
        timeLog(`Message is from unregistered party`);
      }

      // For now, just echo the message back with party info
      const response = {
        type: "response",
        originalMessage: message,
        timestamp: new Date().toISOString(),
      };

      this.outputQueue.push({
        clientId,
        message: response,
      });
    }
  }

  // Send messages from output queue
  async handleOutputQueue() {
    await this.outputQueue.waitForUpdate();

    while (this.outputQueue.length > 0) {
      const { clientId, message } = this.outputQueue.shift();

      if (this.clients.has(clientId)) {
        const ws = this.clients.get(clientId);
        if (ws.readyState === WebSocket.OPEN) {
          timeLog(`Sending response to ${clientId}`);
          ws.send(JSON.stringify(message));
        } else {
          timeLog(`Client ${clientId} connection not open, dropping message`);
        }
      } else {
        timeLog(`Client ${clientId} no longer connected, dropping message`);
      }
    }
  }

  // Main run loop
  async run() {
    console.log("before");
    this.initServer();
    console.log("inbetween");

    while (true) {
      console.log("inloop");
      await Promise.race([this.handleInputQueue(), this.handleOutputQueue()]);
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
