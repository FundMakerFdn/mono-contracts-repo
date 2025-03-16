const WebSocket = require("ws");
const { Queue } = require("./queue");
const custody = require("./otcVM");

/**
 * Time logging utility
 */
const timeLog = (...args) => {
  const stack = new Error().stack;
  const callerName = stack.split("\n")[2].trim().split(" ")[1];
  console.log(
    `${Math.ceil(process.uptime() * 1000)}ms\t${callerName}:`,
    ...args
  );
};

/**
 * pSymmVM class - handles TRADE phase messages
 * This is a minimal implementation that will be expanded later
 */
class pSymmVM {
  constructor(config = {}) {
    this.sessions = {}; // counterpartyPubKey => session object
    this.ppmStorage = config.ppmStorage || {};
    this.guardianPubKey = config.guardianPubKey;
    this.pubKey = config.pubKey;
    this.ppmTemplate = config.ppmTemplate || [];
  }

  processMessage(counterpartyPubKey, inputItem) {
    // This will be implemented in the future to handle TRADE phase messages
    timeLog(`VM processing message from ${counterpartyPubKey}`);
    return null;
  }
}

/**
 * pSymmParty class - implements the system architecture
 * Handles connections, queues, and message flow according to the architecture diagram
 */
class pSymmParty {
  constructor(config = {}) {
    // Server configuration
    this.host = config.host || "127.0.0.1";
    this.port = config.port || 8080;

    // Core components
    this.vm = config.vm || new pSymmVM(config);
    this.pubKey = config.pubKey || "0xDefaultPubKey";

    this.inputQueue = new Queue();
    this.sequencerQueue = new Queue();
    this.outputQueue = new Queue();
    this.guardianQueue = new Queue();
    this.binanceQueue = new Queue();
    this.blockchainQueue = new Queue();

    // Client connections
    this.clients = new Map(); // clientId -> websocket
    this.ipStorage = new Map(); // pubKey -> IP address

    // Sessions
    this.sessions = new Map(); // (pubkey, custody id) => session object
  }

  /**
   * Initialize WebSocket server
   */
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

      // Initialize session for this client
      this.initClientSession(clientId);

      ws.on("message", (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          timeLog(`Received message from ${clientId}:`, parsedMessage);

          // Push to input queue
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

  /**
   * Initialize a session for a new client
   */
  initClientSession(clientId) {
    // For now, we use clientId as the pubKey
    const pubKey = clientId;
    this.ipStorage.set(pubKey, clientId);

    // Initialize session in INIT phase
    this.sessions.set(pubKey, {
      phase: "INIT",
      pubKey,
      custodyId: null,
      msgSeqNum: 1,
    });

    // Push initialization message to input queue
    this.inputQueue.push({
      clientId,
      message: {
        type: "init",
      },
    });
  }

  /**
   * FIX Verifier - validates incoming messages
   * For now, just checks if message is not empty
   */
  verifyMessage(clientId, message) {
    // Simple verification - just check if message exists
    if (!message) {
      timeLog(`Invalid message from ${clientId}: Message is empty`);
      return false;
    }

    // In a real implementation, would verify with PPM Storage
    // and store message to Custody Storage

    timeLog(`Message from ${clientId} verified`);
    return true;
  }

  /**
   * Process messages from the input queue
   */
  async handleInputQueue() {
    await this.inputQueue.waitForUpdate();

    while (this.inputQueue.length > 0) {
      const { clientId, message } = this.inputQueue.shift();
      timeLog(`Processing input from ${clientId}:`);

      // FIX Verifier step
      if (this.verifyMessage(clientId, message)) {
        // If valid, push to sequencer queue
        this.sequencerQueue.push({
          clientId,
          message,
        });
      }
    }
  }

  /**
   * Process messages from the sequencer queue
   */
  async handleSequencerQueue() {
    await this.sequencerQueue.waitForUpdate();

    while (this.sequencerQueue.length > 0) {
      const { clientId, message } = this.sequencerQueue.shift();
      timeLog(`Sequencer processing message from ${clientId}`);

      // Process message through VM or handle directly based on phase
      const pubKey = clientId; // For now, clientId is the pubKey
      const session = this.sessions.get(pubKey);

      if (!session) {
        timeLog(`No session found for ${pubKey}`);
        continue;
      }

      let responses = [];

      if (session.phase === "INIT" || session.phase === "PKXCHG") {
        // Handle INIT and PKXCHG phases directly in pSymmParty
        responses = this.handlePreTradePhase(pubKey, message);
      } else if (session.phase === "TRADE") {
        // Pass to VM for TRADE phase
        const vmResponse = this.vm.processMessage(pubKey, message);
        if (vmResponse) {
          responses = Array.isArray(vmResponse) ? vmResponse : [vmResponse];
        }
      }

      // Push responses to output queue
      if (responses && responses.length > 0) {
        for (const response of responses) {
          this.outputQueue.push({
            clientId: response.counterpartyPubKey || clientId,
            message: response.msg,
            destination: response.destination || "user", // Default to user
          });
        }
      }
    }
  }

  /**
   * Handle pre-TRADE phase messages (INIT and PKXCHG)
   */
  handlePreTradePhase(pubKey, message) {
    const session = this.sessions.get(pubKey);
    const responses = [];

    if (message.type === "init") {
      // Initial connection, send PPMTR request
      timeLog(`Initializing session for ${pubKey}`);

      // For solver, wait for PPMTR from trader
      // For trader, send PPMTR
      // For now, assume we're the solver

      // No response needed, wait for PPMTR from trader
      return responses;
    }

    switch (session.phase) {
      case "INIT":
        if (message.message?.StandardHeader?.MsgType === "PPMTR") {
          // PPM template request received
          timeLog(`PPMTR received from ${pubKey}`);

          // Update session phase
          session.phase = "PKXCHG";
          this.sessions.set(pubKey, session);

          // Send PPM template
          responses.push({
            counterpartyPubKey: pubKey,
            msg: {
              StandardHeader: { MsgType: "PPMT" },
              PPMT: this.vm.ppmTemplate,
            },
          });
        }
        break;

      case "PKXCHG":
        if (message.message?.StandardHeader?.MsgType === "A") {
          // Logon message received
          timeLog(`Logon received from ${pubKey}`);

          // Store counterparty keys
          session.counterpartyGuardianPubKey =
            message.message.StandardTrailer.PublicKey;
          session.counterpartyGuardianIP = message.message.GuardianIP;
          session.phase = "TRADE";
          this.sessions.set(pubKey, session);

          // Send logon response
          responses.push({
            counterpartyPubKey: pubKey,
            msg: this.createLogonMessage(pubKey),
          });
        }
        break;
    }

    return responses;
  }

  /**
   * Create a logon message
   */
  createLogonMessage(counterpartyPubKey) {
    const session = this.sessions.get(counterpartyPubKey);
    return {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "A",
        DeploymentID: 101,
        SenderCompID: this.pubKey,
        TargetCompID: counterpartyPubKey,
        MsgSeqNum: session.msgSeqNum++,
        CustodyID: "0xCustody123", // todo: PPM
        SendingTime: (Date.now() * 1000000).toString(),
      },
      HeartBtInt: 10,
      StandardTrailer: {
        // todo: sign
        PublicKey: this.pubKey,
        Signature: "0xSignature",
      },
    };
  }

  /**
   * Process messages from the output queue
   */
  async handleOutputQueue() {
    await this.outputQueue.waitForUpdate();

    while (this.outputQueue.length > 0) {
      const { clientId, message, destination } = this.outputQueue.shift();

      switch (destination) {
        case "user":
          // Send to guardian queue for user delivery
          this.guardianQueue.push({
            clientId,
            message,
          });
          break;

        case "binance":
          // Send to Binance queue
          this.binanceQueue.push({
            clientId,
            message,
          });
          break;

        case "blockchain":
          // Send to blockchain queue
          this.blockchainQueue.push({
            clientId,
            message,
          });
          break;

        default:
          // Default to guardian queue
          this.guardianQueue.push({
            clientId,
            message,
          });
      }
    }
  }

  /**
   * Process messages from the guardian queue
   */
  async handleGuardianQueue() {
    await this.guardianQueue.waitForUpdate();

    while (this.guardianQueue.length > 0) {
      const { clientId, message } = this.guardianQueue.shift();

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

  /**
   * Process messages from the Binance queue
   */
  async handleBinanceQueue() {
    await this.binanceQueue.waitForUpdate();

    while (this.binanceQueue.length > 0) {
      const { clientId, message } = this.binanceQueue.shift();
      // For now, just log the message
      timeLog(`Binance queue message for ${clientId}:`, message);
    }
  }

  /**
   * Process messages from the blockchain queue
   */
  async handleBlockchainQueue() {
    await this.blockchainQueue.waitForUpdate();

    while (this.blockchainQueue.length > 0) {
      const { clientId, message } = this.blockchainQueue.shift();
      // For now, just log the message
      timeLog(`Blockchain queue message for ${clientId}:`, message);
    }
  }

  /**
   * Main execution loop
   */
  async run() {
    this.initServer();

    // Process all queues in parallel
    while (true) {
      await Promise.race([
        this.handleInputQueue(),
        this.handleSequencerQueue(),
        this.handleOutputQueue(),
        this.handleGuardianQueue(),
        this.handleBinanceQueue(),
        this.handleBlockchainQueue(),
      ]);
    }
  }
}

module.exports = { pSymmVM, pSymmParty, timeLog };
