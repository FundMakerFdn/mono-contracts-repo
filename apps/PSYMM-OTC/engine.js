import { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { Queue } from './queue.js';
import custody from './otcVM.js';
import { getGuardianData } from './common.js';
import { getContractAddresses } from '@fundmaker/pSymmFIX';
import {
  aggregatePublicKeys,
  signMessage,
  verifySignature,
} from '@fundmaker/schnorr';
import { bytesToHex, hexToBytes } from 'viem';

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
    this.sessions = {}; // custody id => session object
    this.pubKey = config.pubKey;
    this.ppmTemplate = config.ppmTemplate || [];
  }

  processMessage(counterpartyPubKey, inputItem) {
    // This will be implemented in the future to handle TRADE phase messages
    timeLog(`VM processing message from ${counterpartyPubKey}`);
    return [];
  }
}

/**
 * pSymmServer class - implements the system architecture
 * Handles connections, queues, and message flow according to the architecture diagram
 */
class pSymmServer {
  constructor(config = {}) {
    // Server configuration
    this.host = config.host || "127.0.0.1";
    this.port = config.port || 8080;
    this.rpcUrl = config.rpcUrl || "http://localhost:8545";
    this.contractAddresses = getContractAddresses();

    // Core components
    this.ourGuardians = []; // Will store our guardian data
    this.vm = config.vm || new pSymmVM(config);
    this.privKey = config.privKey;
    this.pubKey = config.pubKey;
    this.guardianPubKeys = config.guardianPubKeys || [];

    this.inputQueue = new Queue();
    this.sequencerQueue = new Queue();
    this.outputQueue = new Queue();
    this.guardianQueue = new Queue();
    this.binanceQueue = new Queue();
    this.blockchainQueue = new Queue();

    this.clients = new Map(); // clientId -> websocket connection
    this.nextClientId = 1; // For generating unique client IDs
    this.clientToCustodyId = new Map(); // clientId -> custodyId
    this.sessions = new Map(); // custodyId => session object
    this.role = config.role; // solver/trader
  }

  initServer() {
    this.server = new WebSocketServer({
      host: this.host,
      port: this.port,
    });

    timeLog(`WebSocket server started on ${this.host}:${this.port}`);

    this.server.on("connection", (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      const clientId = this.nextClientId++;

      timeLog(`New client connected: ${clientId} from IP: ${clientIp}`);
      this.clients.set(clientId, ws);

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

  getRoleKey(session, role) {
    if (this.role === role) return this.pubKey;
    else return session.counterpartyPubKey;
  }
  getRoleGuardians(session, role) {
    if (role === this.role) {
      return this.guardianPubKeys;
    } else {
      return session.counterpartyGuardianPubKeys;
    }
  }

  aggregatePubKeys(pubKeys) {
    return bytesToHex(
      aggregatePublicKeys(pubKeys).aggregatedKey.toRawBytes(true)
    );
  }

  // get pubkey based on our role and key name (A/B/...)
  getPubKey(session, entry, nameType) {
    if (entry.type === "solver" || entry.type === "trader") {
      return this.getRoleKey(session, entry.type);
    }

    if (entry.type === "guardian") {
      const partyRole = nameType.get(entry.toParty);
      return this.getRoleGuardians(session, partyRole)[entry.guardianIndex];
    }

    // For multisig types
    if (entry.type === "multisig") {
      // Split the name by '+' and get the pubKey for each party
      const parties = entry.name.split("+").map((name) => name.trim());
      const pubKeys = [];

      for (const partyName of parties) {
        // Find the party in the PPM
        if (!partyName.startsWith("G")) {
          pubKeys.push(this.getRoleKey(session, nameType.get(partyName)));
        } else {
          pubKeys.push(
            ...this.getRoleGuardians(session, nameType.get(partyName.slice(1)))
          );
        }
      }

      return pubKeys.length > 0 ? this.aggregatePubKeys(pubKeys) : entry.pubKey;
    }
  }

  renderPPM(session) {
    try {
      // copy PPM object
      const PPM = JSON.parse(JSON.stringify(this.vm.ppmTemplate));

      // Create a map of name to type
      const nameType = new Map(); // name => role
      if (PPM.parties && Array.isArray(PPM.parties)) {
        for (let party of PPM.parties) {
          if (party.name && party.type) {
            nameType.set(party.name, party.type);
          }
        }

        for (let entry of PPM.parties) {
          try {
            entry.pubKey = this.getPubKey(session, entry, nameType);
          } catch (err) {
            timeLog(`Error getting pubKey for ${entry.name}: ${err.message}`);
          }
        }
      }

      return PPM;
    } catch (err) {
      timeLog(`Error rendering PPM: ${err.message}`);
      return this.vm.ppmTemplate; // Return original template as fallback
    }
  }

  async handleLogon(clientId, message) {
    timeLog(`Logon received from ${clientId}`);

    const logonMsg = message;
    const custodyId = logonMsg.StandardHeader.CustodyID;
    const counterpartyPubKey = logonMsg.StandardHeader.SenderCompID;

    // Create new session
    const session = {
      counterpartyPubKey,
      custodyId,
      msgSeqNum: 1,
      counterpartyGuardianPubKeys: logonMsg.GuardianPubKeys,
      heartBtInt: logonMsg.HeartBtInt || 30,
      lastHeartbeat: Date.now(),
      PPM: null,
      guardianConnections: new Map(), // Store guardian WebSocket connections
    };
    session.PPM = this.renderPPM(session);
    console.log(session.PPM);

    // Connect to counterparty guardians
    await this.connectToCounterpartyGuardians(session);

    // Store session
    this.sessions.set(custodyId, session);
    this.clientToCustodyId.set(clientId, custodyId);

    // Send logon response
    this.outputQueue.push({
      clientId,
      message: this.createLogonMessage(counterpartyPubKey, custodyId),
      destination: "user",
    });
  }

  /**
   * Handle PPMHandshake message
   */
  handlePPMHandshake(clientId, message) {
    timeLog(`PPMHandshake received from ${clientId}`);

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
   * Verifies the Schnorr signature in the message trailer
   */
  verifyMessage(clientId, message) {
    // Simple verification - just check if message exists
    if (!message) {
      timeLog(`Invalid message from ${clientId}: Message is empty`);
      return false;
    }

    // Check if message has a StandardTrailer
    if (!message.StandardTrailer) {
      timeLog(`Message from ${clientId} has no StandardTrailer`);
      return false;
    }

    // Check if message has a signature in the trailer
    if (!message.StandardTrailer.Signature) {
      timeLog(`Message from ${clientId} has no signature`);
      return false;
    }
    try {
      // Get signature components
      const signature = message.StandardTrailer.Signature;
      const pubKeyHex = message.StandardTrailer.PublicKey;

      // Create a copy of the message without the signature for verification
      const msgCopy = JSON.parse(JSON.stringify(message));
      msgCopy.StandardTrailer = {};

      // Convert message to bytes for verification
      const msgBytes = new TextEncoder().encode(JSON.stringify(msgCopy));

      // Verify the signature - the library now handles pubKey conversion
      const isValid = verifySignature(
        BigInt(signature.s),
        BigInt(signature.e),
        pubKeyHex,
        msgBytes
      );

      if (!isValid) {
        timeLog(`Invalid signature from ${clientId}`);
        return false;
      }

      timeLog(`Signature from ${clientId} verified successfully`);
    } catch (error) {
      timeLog(`Error verifying signature from ${clientId}: ${error.message}`);
      return false;
    }

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
      if (message?.StandardHeader?.MsgType === "A") {
        this.handleLogon(clientId, message);
        continue;
      }

      // Check if this is a PPMH message
      if (message?.StandardHeader?.MsgType === "PPMH") {
        this.handlePPMHandshake(clientId, message);
        continue;
      }

      // For all other messages, check if client has an established session
      const custodyId = this.clientToCustodyId.get(clientId);
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
      const responses = this.vm.processMessage(
        session.counterpartyPubKey,
        message
      );

      for (const response of responses) {
        this.outputQueue.push({
          clientId: response.counterpartyPubKey || clientId,
          message: response.msg,
          destination: response.destination || "user", // Default to user
        });
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
        SenderCompID: this.pubKey,
        TargetCompID: counterpartyPubKey,
        MsgSeqNum: session.msgSeqNum++,
        CustodyID: custodyId,
        SendingTime: (Date.now() * 1000000).toString(),
      },
      HeartBtInt: 10,
      GuardianPubKeys: this.guardianPubKeys,
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
   * Sign a message with the server's private key
   */
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
    const signature = signMessage(msgBytes, this.privKey);

    message.StandardTrailer.PublicKey = this.pubKey;
    message.StandardTrailer.Signature = {
      s: signature.s.toString(),
      e: signature.challenge.toString(),
    };

    return message;
  }

  /**
   * Process messages from the guardian queue
   */
  async handleGuardianQueue() {
    await this.guardianQueue.waitForUpdate();

    while (this.guardianQueue.length > 0) {
      const { clientId, message } = this.guardianQueue.shift();
      const signedMessage = this.signMessage(message);
      const messageStr = JSON.stringify(signedMessage);

      // Send to counterparty if connected
      if (this.clients.has(clientId)) {
        const ws = this.clients.get(clientId);
        if (ws.readyState === WebSocket.OPEN) {
          timeLog(`Sending signed response to counterparty ${clientId}`);
          ws.send(messageStr);
        }
      }

      // Get the session for this client
      const custodyId = this.clientToCustodyId.get(clientId);
      const session = custodyId ? this.sessions.get(custodyId) : null;

      // Send to all guardian connections in the session mesh
      if (session?.guardianConnections) {
        for (const [guardianPubKey, ws] of session.guardianConnections) {
          if (ws.readyState === WebSocket.OPEN) {
            timeLog(
              `Sending signed response to counterparty guardian ${guardianPubKey}`
            );
            ws.send(messageStr);
          }
        }
      }

      // Send to our guardian connection
      if (this.guardianConnection?.readyState === WebSocket.OPEN) {
        timeLog(`Sending signed response to our guardian`);
        this.guardianConnection.send(messageStr);
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
        SenderCompID: this.pubKey,
        TargetCompID: counterpartyPubKey,
        MsgSeqNum: session.msgSeqNum++,
        CustodyID: custodyId,
        SendingTime: (Date.now() * 1000000).toString(),
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
          ] of this.clientToCustodyId.entries()) {
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
  async connectToCounterpartyGuardians(session) {
    try {
      // Get guardian data for all counterparty guardian public keys
      const guardianPromises = session.counterpartyGuardianPubKeys.map(
        (pubKey) =>
          getGuardianData({
            rpcUrl: this.rpcUrl,
            partyRegistryAddress: this.contractAddresses.partyRegistry,
            myGuardianPubKeys: [pubKey],
          })
      );

      const guardiansData = await Promise.all(guardianPromises);

      // Connect to each guardian
      for (let i = 0; i < guardiansData.length; i++) {
        const guardianData = guardiansData[i][0]; // Take first result for each guardian
        if (!guardianData) {
          timeLog(
            `Guardian not found for pubKey: ${session.counterpartyGuardianPubKeys[i]}`
          );
          continue;
        }

        const guardianPubKey = session.counterpartyGuardianPubKeys[i];
        const ws = new WebSocket(`ws://${guardianData.ipAddress}:8080`);

        // Set up connection handlers
        ws.on("open", () => {
          timeLog(
            `Connected to counterparty guardian ${guardianPubKey} at ${guardianData.ipAddress}`
          );
        });

        ws.on("error", (error) => {
          timeLog(`Error with counterparty guardian ${guardianPubKey}:`, error);
        });

        ws.on("close", () => {
          timeLog(`Disconnected from counterparty guardian ${guardianPubKey}`);
          // Remove from connections map
          session.guardianConnections.delete(guardianPubKey);
        });

        // Wait for connection to establish
        await new Promise((resolve, reject) => {
          ws.once("open", resolve);
          ws.once("error", reject);
        });

        // Store the connection
        session.guardianConnections.set(guardianPubKey, ws);
      }
    } catch (error) {
      timeLog(`Error connecting to counterparty guardians:`, error);
      throw error;
    }
  }

  async connectToGuardians() {
    try {
      const guardianData = await getGuardianData({
        rpcUrl: this.rpcUrl,
        partyRegistryAddress: this.contractAddresses.partyRegistry,
        myGuardianPubKeys: this.guardianPubKeys,
      });

      if (!guardianData.length) {
        throw new Error("Guardian not found");
      }

      const guardian = guardianData[0];
      this.guardianConnection = new WebSocket(
        `ws://${guardian.ipAddress}:8080`
      );
      await new Promise((resolve, reject) => {
        this.guardianConnection.addEventListener("open", resolve);
        this.guardianConnection.addEventListener("error", reject);
      });

      timeLog(`Connected to guardian at ${guardian.ipAddress}`);
    } catch (error) {
      timeLog(`Guardian connection error: ${error.message}`);
      throw error;
    }
  }

  async run() {
    // Connect to guardians before starting server
    await this.connectToGuardians();

    this.initServer();

    // Start all queue handlers as separate tasks
    this.startQueueHandlers();
  }

  startQueueHandlers() {
    // avoid MaxListenersExceededWarning warning
    this.startHandler(this.handleInputQueue.bind(this), "InputQueue");
    this.startHandler(this.handleSequencerQueue.bind(this), "SequencerQueue");
    this.startHandler(this.handleOutputQueue.bind(this), "OutputQueue");
    this.startHandler(this.handleGuardianQueue.bind(this), "GuardianQueue");
    this.startHandler(this.handleBinanceQueue.bind(this), "BinanceQueue");
    this.startHandler(this.handleBlockchainQueue.bind(this), "BlockchainQueue");
    this.startHandler(this.heartbeatWorker.bind(this), "HeartbeatWorker");
  }

  /**
   * Start a handler in a continuous loop
   */
  startHandler(handlerFn, name) {
    const runHandler = async () => {
      try {
        while (true) {
          await handlerFn();
        }
      } catch (error) {
        timeLog(`Error in ${name} handler:`, error);
        // Restart the handler after a short delay
        setTimeout(() => this.startHandler(handlerFn, name), 1000);
      }
    };

    // Start the handler
    runHandler();
  }
}

export { pSymmVM, pSymmServer, timeLog };
