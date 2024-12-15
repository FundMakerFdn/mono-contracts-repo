const { Server } = require("socket.io");
const { io } = require("socket.io-client");
const CustodyRollupTreeBuilder = require("./custodyRollupTreeBuilder");
const { parseEther } = require("viem");

class PSymmParty {
  constructor(config) {
    this.address = config.address;
    this.port = config.port;
    this.walletClient = config.walletClient;
    this.pSymm = config.pSymm;
    this.mockSymm = config.mockSymm;
    this.personalCustodyId = 1; // Default personal custody ID

    // Add nonce counter starting at 0
    this.nonceCounter = 0;

    // Add action queue
    this.onchainActionQueue = [];

    this.treeBuilder = new CustodyRollupTreeBuilder({
      name: "pSymm",
      version: "1.0",
      chainId: 0, // Will be set in start()
      verifyingContract: config.pSymm.address,
    });

    this.server = new Server({
      cors: {
        origin: "*",
      },
      reuseAddr: true,
    });

    this.client = null;
    this.setupMessageHandling = this.setupMessageHandling.bind(this);
    this.setupServer();
  }

  async start() {
    try {
      // Set the chainId in domain
      const chainId = await this.walletClient.getChainId();
      this.treeBuilder.setDomain("pSymm", "1.0", chainId, this.pSymm.address);

      this.server.listen(this.port);
      console.log(`Server listening on port ${this.port}`);
    } catch (err) {
      console.error(`Failed to start server on port ${this.port}:`, err);
      throw err;
    }
  }

  async connectToCounterparty(counterpartyUrl) {
    console.log(`Connecting to counterparty at ${counterpartyUrl}`);
    this.client = io(counterpartyUrl);

    return new Promise((resolve, reject) => {
      this.client.on("connect", () => {
        console.log("Connected as client (party A)");
        this.setupMessageHandling(this.client, true);
        resolve();
      });
      this.client.on("connect_error", (error) => {
        reject(error);
      });
    });
  }

  setupServer() {
    this.server.on("connection", (socket) => {
      console.log("Received connection, acting as server (party B)");
      this.setupMessageHandling(socket, false);

      socket.on("disconnect", () => {
        console.log("\nPeer disconnected. Final Custody Rollup Tree State:");
        console.log(JSON.stringify(this.treeBuilder.getTree(), null, 2));
        console.log("\nMerkle Root:");
        console.log(this.treeBuilder.getMerkleRoot());

        // Reset state after disconnect
        this.treeBuilder.clear();
        this.nonceCounter = 0;
        this.custodyId = undefined;
        console.log("State reset after disconnect");
      });
    });
  }

  async setupMessageHandling(socket, isA) {
    socket.on("tree.propose", async (message) => {
      const counterparty = isA
        ? message.payload.params.partyB
        : message.payload.params.partyA;
      console.log(`\nReceived tree.propose action:
    Type: ${message.payload.params.type}
    Counterparty: ${counterparty}
    CustodyId: ${message.payload.params.custodyId}
  `);

      // For receiving party, use the custodyId from the incoming message
      if (message.payload.params.type === "initialize/billateral/standard") {
        this.custodyId = message.payload.params.custodyId;
      }

      try {
        // Add message to local tree
        const messageHash = await this.treeBuilder.addMessage(
          message.payload.params
        );
        console.log(`Added message to tree with hash: ${messageHash}`);

        // Add the proposer's signature first
        this.treeBuilder.addSignature(messageHash, message.payload.signature);
        console.log("Added proposer's signature to tree");

        // Generate and add own signature
        const signature = await this.walletClient.signMessage({
          message: { raw: messageHash },
        });
        console.log("Generated signature for message");
        this.treeBuilder.addSignature(messageHash, signature);

        // Send signature back
        socket.emit("tree.sign", {
          custodyId: message.payload.params.custodyId,
          messageHash,
          signature,
        });
        console.log("Sent tree.sign response");

        // Queue the action based on message type
        const params = message.payload.params;
        if (params.type === "initialize/billateral/standard") {
          await this.queueOnchainAction({
            type: "createCustody",
            messageHash,
            params: {
              signatureA: message.payload.signature,
              signatureB: signature,
              partyA: params.partyA,
              partyB: params.partyB,
              custodyId: params.custodyId,
              settlementAddress: params.settlementAddress,
              MA: params.MA,
              isManaged: params.isManaged,
              expiration: params.expiration,
              timestamp: params.timestamp,
              partyId: params.partyId,
              nonce: params.nonce,
            },
          });
        } else if (
          params.type === "transfer/deposit/ERC20" ||
          params.type === "transfer/withdraw/ERC20"
        ) {
          await this.queueOnchainAction({
            type: "transferCustody",
            messageHash,
            params: {
              isAdd: params.type === "transfer/deposit/ERC20",
              signatureA: message.payload.signature,
              signatureB: signature,
              partyA: params.partyA,
              partyB: params.partyB,
              custodyId: params.custodyId,
              collateralAmount: parseEther(params.collateralAmount),
              collateralToken: params.collateralToken,
              senderCustodyId: params.senderCustodyId,
              expiration: params.expiration,
              timestamp: params.timestamp,
              partyId: params.partyId,
              nonce: params.nonce,
            },
          });

          // Party B initiates reciprocal transfer
          if (!isA) {
            await this.transferCustody(
              socket,
              params.type === "transfer/deposit/ERC20", // same isAdd value
              params.collateralAmount,
              params.partyA, // reverse the parties
              params.custodyId,
              false // we are party B
            );
          }
        }
      } catch (err) {
        console.error("Failed to process tree.propose:", err);
        socket.emit("tree.reject", {
          custodyId: message.payload.params.custodyId,
          messageHash: message.payload.messageHash,
          reason: err.message,
        });
      }
    });

    socket.on("tree.sign", async (message) => {
      console.log(`\nReceived tree.sign response:
    CustodyId: ${message.custodyId}
    MessageHash: ${message.messageHash}
  `);

      this.treeBuilder.addSignature(message.messageHash, message.signature);
      console.log("Added counterparty signature to tree");

      const isFullySigned = this.treeBuilder.isMessageFullySigned(
        message.messageHash
      );
      console.log(`Message is ${isFullySigned ? "fully" : "NOT fully"} signed`);
    });

    socket.on("tree.reject", (message) => {
      console.error(`\nTree action rejected:
    CustodyId: ${message.custodyId}
    Reason: ${message.reason}
    MessageHash: ${message.messageHash}
  `);
    });
  }

  async depositPersonal(amount) {
    console.log(
      `\nInitiating deposit of ${amount} tokens to personal custody ${this.personalCustodyId}...`
    );

    console.log("Approving token transfer...");
    await this.mockSymm.write.approve(
      [this.pSymm.address, parseEther(amount)],
      {
        account: this.walletClient.account,
      }
    );
    console.log("Token transfer approved");

    console.log("Executing deposit transaction...");
    await this.pSymm.write.deposit(
      [this.mockSymm.address, parseEther(amount), this.personalCustodyId],
      {
        account: this.walletClient.account,
      }
    );
    console.log("Deposit transaction completed successfully");
  }

  async proposeTransfer(params) {
    console.log(`\nProposing transfer:
    Type: ${params.type}
    From: ${params.partyA}
    To: ${params.partyB}
    CustodyId: ${params.custodyId}
    Amount: ${params.amount}
  `);

    const messageHash = await this.treeBuilder.addMessage(params);
    console.log(`Generated message hash: ${messageHash}`);

    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash },
    });
    console.log("Generated signature for transfer");

    this.treeBuilder.addSignature(messageHash, signature);
    console.log("Added own signature to tree");

    const socket = this.client || this.server;
    socket.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: params.custodyId,
        messageHash,
        signature,
        params,
      },
    });
    console.log("Sent tree.propose to counterparty");

    // Wait for counterparty signature
    return new Promise((resolve) => {
      socket.once("tree.sign", (response) => {
        if (response.messageHash === messageHash) {
          resolve(response.signature);
        }
      });
    });
  }

  // Helper method to generate and increment nonce
  generateNonce() {
    this.nonceCounter++;
    return this.nonceCounter;
  }

  async initiateCustodyFlow(counterpartyAddress, custodyId) {
    console.log("\nInitiating custody flow...");
    this.custodyId = custodyId;

    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 3600;

    // Create custody init message
    const initMessage = {
      type: "initialize/billateral/standard",
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: custodyId,
      settlementAddress: this.pSymm.address,
      MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
      isManaged: false,
      expiration,
      timestamp,
      partyId: 1,
      nonce: this.generateNonce(), // We are PartyA
    };

    // Get message hash and sign it directly
    const messageHash = await this.treeBuilder.addMessage(initMessage);
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash },
    });

    // Add our signature to the tree
    this.treeBuilder.addSignature(messageHash, signature);

    // Send to counterparty with domain and types
    this.client.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: this.custodyId,
        messageHash,
        signature,
        params: initMessage,
        domain: this.treeBuilder.getDomain(),
        types: this.treeBuilder.getTypes(),
      },
    });

    // Wait for counterparty signature
    const counterpartySignature = await new Promise((resolve) => {
      this.client.once("tree.sign", (response) => {
        if (response.messageHash === messageHash) {
          resolve(response.signature);
        }
      });
    });

    console.log("Signature A:", signature);
    console.log("Signature B:", counterpartySignature);
    // Create custody on-chain with both signatures
    await this.queueOnchainAction({
      type: "createCustody",
      messageHash,
      params: {
        signatureA: signature,
        signatureB: counterpartySignature,
        partyA: this.address,
        partyB: counterpartyAddress,
        custodyId: this.custodyId,
        settlementAddress: this.pSymm.address,
        MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
        isManaged: false,
        expiration: Math.floor(Date.now() / 1000) + 3600,
        timestamp: Math.floor(Date.now() / 1000),
        partyId: 1,
        nonce: initMessage.nonce,
      },
    });

    console.log("Custody creation queued");
  }

  async transferCustody(
    socket,
    isAdd,
    amount,
    counterpartyAddress,
    custodyId,
    isPartyA
  ) {
    // Define the two parties
    const thisParty = {
      address: this.address,
      wallet: this.walletClient,
    };

    const counterparty = {
      address: counterpartyAddress,
    };

    // Determine who is A and B
    const partyA = isPartyA ? thisParty : counterparty;
    const partyB = isPartyA ? counterparty : thisParty;

    console.log("\nInitiating transfer:", isAdd ? "deposit" : "withdraw");
    console.log("This party is:", isPartyA ? "Party A" : "Party B");

    const transferMessage = {
      isAdd: isAdd,
      type: isAdd ? "transfer/deposit/ERC20" : "transfer/withdraw/ERC20",
      partyA: partyA.address,
      partyB: partyB.address,
      custodyId: custodyId,
      collateralAmount: amount,
      collateralToken: this.mockSymm.address,
      senderCustodyId: "0x" + "0".repeat(64),
      expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      partyId: isPartyA ? 1 : 2,
      nonce: this.generateNonce(),
    };

    const { messageHash, ownSignature, counterpartySignature } = 
      await this.proposeAndSignMessage(socket, transferMessage);

    // Execute the transfer onchain
    await this.queueOnchainAction({
      type: "transferCustody",
      messageHash,
      params: {
        isAdd: isAdd,
        signatureA: isPartyA ? ownSignature : counterpartySignature,
        signatureB: isPartyA ? counterpartySignature : ownSignature,
        partyA: partyA.address,
        partyB: partyB.address,
        custodyId: custodyId,
        collateralAmount: parseEther(amount),
        collateralToken: this.mockSymm.address,
        senderCustodyId: "0x" + "0".repeat(64),
        expiration: Math.floor(Date.now() / 1000) + 3600,
        timestamp: Math.floor(Date.now() / 1000),
        partyId: isPartyA ? 1 : 2,
        nonce: transferMessage.nonce,
      },
    });

    console.log("Transfer custody queued");
  }

  async withdrawPersonal(amount) {
    console.log(
      `\nInitiating withdrawal of ${amount} tokens from personal custody ${this.personalCustodyId}...`
    );

    console.log("Executing withdrawal transaction...");
    await this.pSymm.write.withdraw(
      [this.mockSymm.address, parseEther(amount), this.personalCustodyId],
      {
        account: this.walletClient.account,
      }
    );
    console.log("Withdrawal transaction completed successfully");
  }

  async queueOnchainAction(action) {
    const hasRequiredSignatures = this.treeBuilder.isMessageFullySigned(
      action.messageHash
    );

    if (!hasRequiredSignatures) {
      throw new Error("Cannot queue action - missing required signatures");
    }

    this.onchainActionQueue.push(action);
    console.log(
      `Action queued. Queue length: ${this.onchainActionQueue.length}`
    );
  }

  async executeOnchain(partyId = null, n = null) {
    if (this.onchainActionQueue.length === 0) {
      console.log("No actions in queue");
      return;
    }

    let actionsToExecute = [...this.onchainActionQueue];

    // Filter by partyId if specified
    if (partyId !== null) {
      actionsToExecute = actionsToExecute.filter(
        (action) => action.params.partyId === partyId
      );
    }

    // Limit number of actions if n is specified
    if (n !== null) {
      actionsToExecute = actionsToExecute.slice(0, n);
    }

    if (actionsToExecute.length === 0) {
      console.log("No matching actions to execute");
      return;
    }

    console.log(`Executing ${actionsToExecute.length} queued actions`);
    for (const action of actionsToExecute) {
      await this.executeAction(action);
      // Remove the executed action from the queue
      const index = this.onchainActionQueue.indexOf(action);
      if (index > -1) {
        this.onchainActionQueue.splice(index, 1);
      }
    }
    console.log("Execution complete");
  }

  async proposeAndSignMessage(socket, message) {
    // Add message to tree and get hash
    const messageHash = await this.treeBuilder.addMessage(message);
    
    // Get our signature
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash },
    });
    
    // Add our signature to tree
    this.treeBuilder.addSignature(messageHash, signature);

    // Send to counterparty and wait for their signature
    socket.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: message.custodyId,
        messageHash,
        signature,
        params: message,
      },
    });

    // Wait for and return counterparty signature
    const counterpartySignature = await new Promise((resolve) => {
      socket.once("tree.sign", (response) => {
        if (response.messageHash === messageHash) {
          resolve(response.signature);
        }
      });
    });

    return {
      messageHash,
      ownSignature: signature, 
      counterpartySignature
    };
  }

  async executeAction(action) {
    switch (action.type) {
      case "createCustody":
        await this.pSymm.write.CreateCustody([action.params], {
          account: this.walletClient.account,
        });
        break;

      case "transferCustody":
        await this.pSymm.write.transferCustody(
          [action.params, this.personalCustodyId],
          {
            account: this.walletClient.account,
          }
        );
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  dropActionQueue() {
    const count = this.onchainActionQueue.length;
    this.onchainActionQueue = [];
    console.log(`Dropped ${count} actions from queue`);
  }

  stop() {
    if (this.client) {
      this.client.close();
    }
    this.server.close();
  }
}

module.exports = PSymmParty;
