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
    this.nextClientId = 1; // For generating unique client IDs

    // Client to session mapping
    this.clientToSession = new Map(); // clientId -> custodyId

    // Sessions
    this.sessions = new Map(); // custodyId => session object
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
      const clientIp = req.socket.remoteAddress;
      const clientId = this.nextClientId++;

      timeLog(`New client connected: ${clientId} from IP: ${clientIp}`);
      this.clients.set(clientId, ws);

      // No longer initializing session here - will wait for Logon

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
   * Handle logon message
   */
  handleLogon(clientId, message) {
    timeLog(`Logon received from ${clientId}`);

    const logonMsg = message.message;
    const custodyId = logonMsg.StandardHeader.CustodyID;
    const counterpartyPubKey = logonMsg.StandardHeader.SenderCompID;

    // Create new session
    const session = {
      counterpartyPubKey,
      custodyId,
      msgSeqNum: 1,
      counterpartyGuardianPubKey: logonMsg.StandardTrailer.PublicKey,
      counterpartyGuardianIP: logonMsg.GuardianIP,
      heartBtInt: logonMsg.HeartBtInt || 30,
      lastHeartbeat: Date.now(),
    };

    // Store session
    this.sessions.set(custodyId, session);
    this.clientToSession.set(clientId, custodyId);

    // Send logon response
    this.outputQueue.push({
      clientId,
      message: this.createLogonMessage(counterpartyPubKey, custodyId),
      destination: "user",
    });
  }

  /**
   * Handle PPMTR message
   */
  handlePPMTR(clientId, message) {
    timeLog(`PPMTR received from ${clientId}`);

    // Send PPM template
    this.outputQueue.push({
      clientId,
      message: {
        StandardHeader: { MsgType: "PPMT" },
        PPMT: this.vm.ppmTemplate,
      },
      destination: "user",
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

      // Check if this is a logon message
      if (message.message?.StandardHeader?.MsgType === "A") {
        this.handleLogon(clientId, message);
        continue;
      }

      // Check if this is a PPMTR message
      if (message.message?.StandardHeader?.MsgType === "PPMTR") {
        this.handlePPMTR(clientId, message);
        continue;
      }

      // For all other messages, check if client has an established session
      const custodyId = this.clientToSession.get(clientId);
      if (!custodyId) {
        timeLog(`No session found for client ${clientId}, ignoring message`);
        continue;
      }

      const session = this.sessions.get(custodyId);
      if (!session) {
        timeLog(`Session ${custodyId} not found, ignoring message`);
        continue;
      }

      // Process message through VM for established sessions
      const vmResponse = this.vm.processMessage(
        session.counterpartyPubKey,
        message
      );
      if (vmResponse) {
        const responses = Array.isArray(vmResponse) ? vmResponse : [vmResponse];

        // Push responses to output queue
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
   * Create a logon message
   */
  createLogonMessage(counterpartyPubKey, custodyId) {
    const session = this.sessions.get(custodyId);
    return {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "A",
        DeploymentID: 101, // todo
        SenderCompID: this.pubKey,
        TargetCompID: counterpartyPubKey,
        MsgSeqNum: session.msgSeqNum++,
        CustodyID: custodyId,
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
   * Create a heartbeat message
   */
  createHeartbeatMessage(counterpartyPubKey, custodyId) {
    const session = this.sessions.get(custodyId);
    return {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "0", // Heartbeat message type
        DeploymentID: 101,
        SenderCompID: this.pubKey,
        TargetCompID: counterpartyPubKey,
        MsgSeqNum: session.msgSeqNum++,
        CustodyID: custodyId,
        SendingTime: (Date.now() * 1000000).toString(),
      },
      StandardTrailer: {
        // todo: sign
        PublicKey: this.pubKey,
        Signature: "0xSignature",
      },
    };
  }

  /**
   * Heartbeat worker - sends heartbeat messages based on HeartBtInt
   */
  async heartbeatWorker() {
    // Check every second for sessions that need heartbeats
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const now = Date.now();

    for (const [custodyId, session] of this.sessions.entries()) {
      if (session.heartBtInt) {
        // Convert heartBtInt from seconds to milliseconds
        const heartbeatInterval = session.heartBtInt * 1000;

        // Check if it's time to send a heartbeat
        if (now - session.lastHeartbeat >= heartbeatInterval) {
          timeLog(`Sending heartbeat for session ${custodyId}`);

          // Update last heartbeat time
          session.lastHeartbeat = now;
          this.sessions.set(custodyId, session);

          // Find clientId for this session
          let targetClientId = null;
          for (const [
            clientId,
            sessionCustodyId,
          ] of this.clientToSession.entries()) {
            if (sessionCustodyId === custodyId) {
              targetClientId = clientId;
              break;
            }
          }

          if (targetClientId) {
            // Push heartbeat message to output queue
            this.outputQueue.push({
              clientId: targetClientId,
              message: this.createHeartbeatMessage(
                session.counterpartyPubKey,
                custodyId
              ),
              destination: "user",
            });
          }
        }
      }
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
        this.heartbeatWorker(),
      ]);
    }
  }
}

module.exports = { pSymmVM, pSymmParty, timeLog };
