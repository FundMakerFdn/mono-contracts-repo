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
      } catch (err) {
        console.error("Failed to process tree.propose:", err);
        socket.emit("tree.reject", {
          custodyId: message.payload.params.custodyId,
          messageHash: message.payload.messageHash,
          reason: err.message,
        });
      }

      if (!isA) {
        if (message.payload.params.type === "transfer/deposit/ERC20") {
          await this.transferCustody(
            socket,
            true,
            message.payload.params.collateralAmount,
            counterparty,
            message.payload.params.custodyId,
            isA
          );
        }
        if (message.payload.params.type === "transfer/withdraw/ERC20") {
          await this.transferCustody(
            socket,
            false,
            message.payload.params.collateralAmount,
            counterparty,
            message.payload.params.custodyId,
            isA
          );
        }
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

  async deposit(amount) {
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
    await this.pSymm.write.CreateCustody(
      [
        {
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
      ],
      {
        account: this.walletClient.account,
      }
    );

    console.log("Custody created on-chain");
  }

  async transferCustody(
    socket,
    isAdd,
    amount,
    counterpartyAddress,
    custodyId,
    isPartyA
  ) {
    // Define the two parties with their signatures
    const thisParty = {
      address: this.address,
      wallet: this.walletClient,
      signature: null,
    };

    const counterparty = {
      address: counterpartyAddress,
      signature: null,
    };

    // Determine who is A and B (we use a ref to objects)
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

    // Add message to tree and get our signature
    const messageHash = await this.treeBuilder.addMessage(transferMessage);
    thisParty.signature = await thisParty.wallet.signMessage({
      message: { raw: messageHash },
    });
    this.treeBuilder.addSignature(messageHash, thisParty.signature);

    // Send to counterparty and wait for their signature
    socket.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: custodyId,
        messageHash,
        signature: thisParty.signature,
        params: transferMessage,
      },
    });

    // Wait for counterparty signature
    counterparty.signature = await new Promise((resolve) => {
      socket.once("tree.sign", (response) => {
        if (response.messageHash === messageHash) {
          resolve(response.signature);
        }
      });
    });

    // Execute the transfer onchain
    await this.pSymm.write.transferCustody(
      [
        {
          isAdd: isAdd,
          signatureA: partyA.signature,
          signatureB: partyB.signature,
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
        this.personalCustodyId,
      ],
      {
        account: thisParty.wallet.account,
      }
    );
  }

  async withdraw(amount) {
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

  stop() {
    if (this.client) {
      this.client.close();
    }
    this.server.close();
  }
}

module.exports = PSymmParty;
