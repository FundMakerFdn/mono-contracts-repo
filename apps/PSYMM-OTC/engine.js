const WebSocket = require("ws");
const EventEmitter = require("events");

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

// Base Solver Engine implementation
class SolverEngine {
  constructor(host = "127.0.0.2", port = 8080) {
    this.host = host;
    this.port = port;
    this.inputQueue = new Queue();
    this.outputQueue = new Queue();
    this.clients = new Map(); // clientId -> websocket
    this.clientState = new Map(); // clientId -> client state object
  }

  // Initialize WebSocket server
  initServer() {
    this.server = new WebSocket.Server({
      host: this.host,
      port: this.port,
    });

    timeLog(`WebSocket server started on ${this.host}:${this.port}`);

    this.server.on("connection", async (ws, req) => {
      const clientId = req.socket.remoteAddress; //+ ":" + req.socket.remotePort;
      const clientIp = req.socket.remoteAddress;

      // Check if client is already connected
      if (this.clientState.has(clientId)) {
        timeLog(`Client ${clientId} already connected. Rejecting connection.`);
        ws.close(1000, "Already connected");
        return;
      }

      timeLog(`New client connected: ${clientId} from IP: ${clientIp}`);

      this.clients.set(clientId, ws);
      this.clientState.set(clientId, {}); // Initialize state object

      ws.on("message", (message) => {
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
        this.clientState.delete(clientId);
        this.onClientDisconnect(clientId);
      });

      ws.on("error", (error) => {
        timeLog(`Error with client ${clientId}:`, error);
      });

      // Call the onClientConnect hook for subclasses to implement
      await this.onClientConnect(clientId, clientIp, ws);
    });
  }

  // Hook for subclasses to implement client connection logic
  async onClientConnect(clientId, clientIp, ws) {
    // To be implemented by subclasses
  }

  // Hook for subclasses to implement client disconnection logic
  onClientDisconnect(clientId) {
    // To be implemented by subclasses
  }

  // Process messages from input queue - to be implemented by subclasses
  async handleInputQueue() {
    await this.inputQueue.waitForUpdate();

    while (this.inputQueue.length > 0) {
      const { clientId, message } = this.inputQueue.shift();
      timeLog(`Processing message from ${clientId}:`);
      console.log(JSON.stringify(message, null, 2));
      
      // Subclasses should override this method to handle specific message types
      await this.processMessage(clientId, message);
    }
  }

  // Hook for subclasses to implement message processing
  async processMessage(clientId, message) {
    // To be implemented by subclasses
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
    this.initServer();

    while (true) {
      await Promise.race([this.handleInputQueue(), this.handleOutputQueue()]);
    }
  }
}

module.exports = { SolverEngine, Queue, timeLog };
