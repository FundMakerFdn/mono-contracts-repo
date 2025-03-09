const WebSocket = require("ws");
const { Queue } = require("./queue");
const { pSymmVM, timeLog } = require("./vm");

/**
 * pSymmParty class - handles connections, message relay, and external integrations
 */
class pSymmParty {
  constructor(host = "127.0.0.1", port = 8080) {
    this.host = host;
    this.port = port;
    this.vm = new pSymmVM();
    this.inputQueue = new Queue();
    this.outputQueue = new Queue();
    this.clients = new Map(); // clientId -> websocket

    // Guardian connection info
    // this.guardian = {
    //   ip: null,
    //   ws: null,
    //   pubkey: null,
    // };

    // Placeholder for blockchain client
    this.publicClient = null;

    // Placeholder for binance API
    this.binanceApi = null;
  }

  initServer() {
    this.server = new WebSocket.Server({
      host: this.host,
      port: this.port,
    });

    timeLog(`WebSocket server started on ${this.host}:${this.port}`);

    this.server.on("connection", (ws, req) => {
      const clientId = req.socket.remoteAddress;
      const clientIp = req.socket.remoteAddress;

      timeLog(`New client connected: ${clientId} from IP: ${clientIp}`);
      this.clients.set(clientId, ws);

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
      });

      ws.on("error", (error) => {
        timeLog(`Error with client ${clientId}:`, error);
      });
    });
  }

  // connectToGuardian(guardianIp, guardianPubkey) {
  //   timeLog(`Connecting to guardian at ${guardianIp}...`);

  //   // Implementation placeholder
  //   this.guardian.ip = guardianIp;
  //   this.guardian.pubkey = guardianPubkey;

  //   // Actual WebSocket connection would be implemented here
  //   timeLog(`Connected to guardian at ${guardianIp}`);
  // }

  async handleInputQueue() {
    await this.inputQueue.waitForUpdate();

    while (this.inputQueue.length > 0) {
      const { clientId, message } = this.inputQueue.shift();
      timeLog(`Processing message from ${clientId}:`);
      console.log(JSON.stringify(message, null, 2));

      // Process message through VM
      const response = this.vm.processMessage(clientId, message);

      if (response) {
        this.outputQueue.push({
          clientId,
          message: response,
        });
      }
    }
  }

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

  async run() {
    this.initServer();

    while (true) {
      await Promise.race([this.handleInputQueue(), this.handleOutputQueue()]);
    }
  }
}

module.exports = { pSymmParty };
