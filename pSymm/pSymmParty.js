const { Server } = require("socket.io");
const { io } = require("socket.io-client");
const CustodyRollupTreeBuilder = require("./custodyRollupTreeBuilder");
const {
  parseEther,
  verifyMessage,
  getAddress,
  decodeEventLog,
} = require("viem");

class PSymmParty {
  constructor(config) {
    this.address = config.address;
    this.port = config.port;
    this.walletClient = config.walletClient;
    this.publicClient = config.publicClient;
    this.pSymm = config.pSymm;
    this.pSymmSettlement = config.pSymmSettlement;
    this.mockSymm = config.mockSymm;
    this.personalCustodyId = 1; // Default personal custody ID

    // Add nonce counter starting at 0
    this.nonceCounter = 0;

    // Add action queue
    this.onchainActionQueue = [];

    // Add event tracking
    this.unwatchFunctions = [];
    this.counterpartyBalances = new Map(); // Map<address, Map<token, amount>>
    this.eventSubscriptions = new Map(); // Map<socket, Set<Function>>

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
      this.client.on("connect", async () => {
        console.log("Connected as client (party A)");
        await this.subscribeToEvents(this.client);
        this.setupMessageHandling(this.client, true);
        resolve();
      });
      this.client.on("connect_error", (error) => {
        reject(error);
      });
    });
  }

  setupServer() {
    this.server.on("connection", async (socket) => {
      console.log("Received connection, acting as server (party B)");
      await this.subscribeToEvents(socket);
      this.setupMessageHandling(socket, false);

      socket.on("disconnect", () => {
        console.log("\nPeer disconnected. Final Custody Rollup Tree State:");
        console.log(JSON.stringify(this.treeBuilder.getTree(), null, 2));
        console.log("\nMerkle Root:");
        console.log(this.treeBuilder.getMerkleRoot());

        // Cleanup events
        this.cleanupSocketEvents(socket);

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
      // Only handle custody-related actions
      const validTypes = [
        "initialize/bilateral/standard",
        "transfer/deposit/ERC20",
        "transfer/withdraw/ERC20",
      ];

      if (!validTypes.includes(message.payload.params.type)) {
        console.log(
          `(base handler) Ignoring non-custody message type: ${message.payload.params.type}`
        );
        return;
      }

      const counterparty = isA
        ? message.payload.params.partyB
        : message.payload.params.partyA;
      // console.log(`\nReceived tree.propose action:
      // Type: ${message.payload.params.type}
      // Counterparty: ${counterparty}
      // CustodyId: ${message.payload.params.custodyId}
      // `);

      // For receiving party, use the custodyId from the incoming message
      if (message.payload.params.type === "initialize/bilateral/standard") {
        this.custodyId = message.payload.params.custodyId;
      }

      try {
        const { messageHash, signature } = await this.handleTreePropose(
          socket,
          message
        );

        // Queue the action based on message type
        const params = message.payload.params;
        if (params.type === "initialize/bilateral/standard") {
          await this.queueOnchainAction({
            type: "createCustody",
            messageHash,
            params: {
              signatureA: message.payload.signature,
              signatureB: signature,
              ...params,
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
        }
      } catch (err) {
        console.error("tree.propose rejected", err);
        socket.emit("tree.reject", {
          custodyId: message.payload.params.custodyId,
          messageHash: message.payload.messageHash,
          reason: err.message,
        });
        socket.disconnect();
      }
    });

    socket.on("tree.sign", async (message) => {
      // console.log(`\nReceived tree.sign response:
      // CustodyId: ${message.custodyId}
      // MessageHash: ${message.messageHash}
      // `);

      // Find the message in the tree to get counterparty address
      const treeMessage = this.treeBuilder.messages.find(
        (m) => m.messageHash === message.messageHash
      );
      if (!treeMessage) {
        console.error("Message not found in tree");
        return;
      }

      // Get counterparty address based on whether we are party A or B
      const counterpartyAddress = isA
        ? treeMessage.params.partyB
        : treeMessage.params.partyA;

      // Validate the signature
      const isValid = await this.validateSignature(
        message.messageHash,
        message.signature,
        counterpartyAddress
      );

      if (!isValid) {
        console.error("Invalid signature from counterparty");
        socket.emit("tree.reject", {
          custodyId: message.custodyId,
          messageHash: message.messageHash,
          reason: "Invalid signature",
        });
        return;
      }

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

  // Helper method to generate and increment nonce
  generateNonce() {
    return Date.now();
    // this.nonceCounter++;
    // return this.nonceCounter;
  }

  async initiateCustodyFlow(counterpartyAddress, custodyId) {
    console.log("\nInitiating custody flow...");
    this.custodyId = custodyId;

    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 3600;

    // Create custody init message
    const initMessage = {
      type: "initialize/bilateral/standard",
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: custodyId,
      settlementAddress: this.pSymmSettlement.address,
      MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
      isManaged: false,
      custodyType: 1, // bilateral
      expiration,
      timestamp,
      partyId: 1,
      nonce: this.generateNonce(), // We are PartyA
    };

    const {
      messageHash,
      ownSignature: signature,
      counterpartySignature,
    } = await this.proposeAndSignMessage(this.client, initMessage);

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
        settlementAddress: this.pSymmSettlement.address,
        MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
        isManaged: false,
        custodyType: 1,
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
      `Action ${action.type} queued. Queue length: ${this.onchainActionQueue.length}`
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

  async validateSignature(messageHash, signature, signerAddress) {
    return await verifyMessage({
      address: signerAddress,
      message: { raw: messageHash },
      signature,
    });
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
    this.treeBuilder.addSignature(messageHash, counterpartySignature);

    return {
      messageHash,
      ownSignature: signature,
      counterpartySignature,
    };
  }

  async executeAction(action) {
    let hash;
    switch (action.type) {
      case "createCustody":
        hash = await this.pSymm.write.CreateCustody([action.params], {
          account: this.walletClient.account,
        });
        break;

      case "transferCustody":
        hash = await this.pSymm.write.transferCustody(
          [action.params, this.personalCustodyId],
          {
            account: this.walletClient.account,
          }
        );
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    // Wait for transaction to be mined
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction ${hash} confirmed`);
  }

  async handleTreePropose(socket, message) {
    const messageHash = await this.treeBuilder.addMessage(
      message.payload.params
    );
    console.log(`Added message to tree with hash: ${messageHash}`);

    // Add the proposer's signature first
    this.treeBuilder.addSignature(messageHash, message.payload.signature);

    // Generate and add own signature
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash },
    });
    this.treeBuilder.addSignature(messageHash, signature);

    // Send signature back
    socket.emit("tree.sign", {
      custodyId: message.payload.params.custodyId,
      messageHash,
      signature,
    });

    return {
      messageHash,
      signature,
    };
  }

  dropActionQueue() {
    const count = this.onchainActionQueue.length;
    this.onchainActionQueue = [];
    console.log(`Dropped ${count} actions from queue`);
  }

  stop() {
    // Cleanup all socket event subscriptions
    for (const [socket, unsubscribes] of this.eventSubscriptions) {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    }
    this.eventSubscriptions.clear();

    if (this.client) {
      this.client.close();
    }
    this.server.close();
  }

  async subscribeToEvents(socket) {
    // Create a new set for this socket's unwatch functions
    if (!this.eventSubscriptions.has(socket)) {
      this.eventSubscriptions.set(socket, new Set());
    }

    // Subscribe to TransferToCustody events
    const unwatchTransfer = await this.publicClient.watchContractEvent({
      address: this.pSymm.address,
      abi: this.pSymm.abi,
      eventName: "TransferToCustody",
      onLogs: (logs) => {
        logs.forEach((log) => {
          try {
            const event = decodeEventLog({
              abi: this.pSymm.abi,
              data: log.data,
              topics: log.topics,
            });
            this.handleTransferToCustody(
              socket,
              event.args.custodyId,
              event.args.collateralToken,
              event.args.amount,
              event.args.sender
            );
          } catch (error) {
            console.error("Error processing TransferToCustody event:", error);
          }
        });
      },
      pollingInterval: 1000,
    });
    this.eventSubscriptions.get(socket).add(unwatchTransfer);

    // Subscribe to WithdrawFromCustody events
    const unwatchWithdraw = await this.publicClient.watchContractEvent({
      address: this.pSymm.address,
      abi: this.pSymm.abi,
      eventName: "WithdrawFromCustody",
      onLogs: (logs) => {
        logs.forEach((log) => {
          try {
            const event = decodeEventLog({
              abi: this.pSymm.abi,
              data: log.data,
              topics: log.topics,
            });
            this.handleWithdrawFromCustody(
              socket,
              event.args.custodyId,
              event.args.collateralToken,
              event.args.amount,
              event.args.receiver
            );
          } catch (error) {
            console.error("Error processing WithdrawFromCustody event:", error);
          }
        });
      },
      pollingInterval: 1000,
    });
    this.eventSubscriptions.get(socket).add(unwatchWithdraw);

    console.log("Subscribed to custody transfer events");
  }

  handleTransferToCustody(socket, custodyId, _token, amount, _sender) {
    // Get or create balance map for this counterparty
    const sender = getAddress(_sender);
    const collateralToken = getAddress(_token);
    if (!this.counterpartyBalances.has(sender)) {
      this.counterpartyBalances.set(sender, new Map());
    }
    const balances = this.counterpartyBalances.get(sender);

    // Update token balance
    const currentBalance = balances.get(collateralToken) || 0n;
    balances.set(collateralToken, currentBalance + amount);
    this.counterpartyBalances.set(sender, balances);

    console.log(
      `Event: Transfer to custody from ${sender}: ${amount} of token ${collateralToken}`
    );
  }

  handleWithdrawFromCustody(socket, custodyId, _token, amount, _receiver) {
    // Get or create balance map for this counterparty
    const receiver = getAddress(_receiver);
    const collateralToken = getAddress(_token);
    if (!this.counterpartyBalances.has(receiver)) {
      this.counterpartyBalances.set(receiver, new Map());
    }
    const balances = this.counterpartyBalances.get(receiver);

    // Update token balance
    const currentBalance = balances.get(collateralToken) || 0n;
    balances.set(collateralToken, currentBalance - amount);
    this.counterpartyBalances.set(receiver, balances);

    console.log(
      `Event: Transfer from custody from ${receiver}: ${amount} of token ${collateralToken}`
    );
  }

  cleanupSocketEvents(socket) {
    if (this.eventSubscriptions.has(socket)) {
      const unsubscribes = this.eventSubscriptions.get(socket);
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
      this.eventSubscriptions.delete(socket);
      console.log("Cleaned up socket event subscriptions");
    }
  }

  getCounterpartyBalance(counterpartyAddress, token) {
    if (!this.counterpartyBalances.has(counterpartyAddress)) {
      return 0n;
    }
    const balances = this.counterpartyBalances.get(counterpartyAddress);
    return balances.get(token) || 0n;
  }

  async waitForBalance(_address, _token, requiredAmount) {
    const counterpartyAddress = getAddress(_address);
    const token = getAddress(_token);
    console.log(
      `Waiting for ${counterpartyAddress} to have balance >= ${requiredAmount} of token ${token}`
    );

    return new Promise((resolve) => {
      const checkBalance = () => {
        const currentBalance = this.getCounterpartyBalance(
          counterpartyAddress,
          token
        );
        console.log(
          `Current balance: ${currentBalance}, Required: ${requiredAmount}`
        );

        if (currentBalance >= requiredAmount) {
          console.log("Required balance reached");
          resolve();
        } else {
          // Check again in 1 second
          setTimeout(checkBalance, 1000);
        }
      };

      // Start checking
      checkBalance();
    });
  }
}

module.exports = PSymmParty;
