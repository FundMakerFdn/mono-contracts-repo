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
        console.log("Connected as PartyA");
        this.setupPartyAClient();
        resolve();
      });
      this.client.on("connect_error", (error) => {
        reject(error);
      });
    });
  }

  setupServer() {
    this.server.on("connection", (socket) => {
      console.log("Received connection, acting as PartyB");
      this.setupPartyBSocket(socket);

      socket.on("disconnect", () => {
        console.log("\nPartyA disconnected. Final Custody Rollup Tree State:");
        console.log(JSON.stringify(this.treeBuilder.getTree(), null, 2));
      });
    });
  }

  setupPartyBSocket(socket) {
    socket.on("tree.propose", async (message) => {
      console.log(`\nReceived tree.propose action as PartyB:
    Type: ${message.payload.params.type}
    From: ${message.payload.params.partyA}
    CustodyId: ${message.payload.custodyId}
  `);

      // For PartyB, use the custodyId from the incoming message
      if (message.payload.params.type === "custody/init/vanilla") {
        this.custodyId = message.payload.params.custodyId;
      }

      try {
        const messageHash = await this.treeBuilder.addMessage(
          message.payload.params
        );
        console.log(`Added message to tree with hash: ${messageHash}`);

        const signature = await this.walletClient.signMessage({
          message: { raw: messageHash },
        });
        console.log("Generated signature for message");

        socket.emit("tree.sign", {
          custodyId: message.payload.custodyId,
          messageHash,
          signature,
        });
        console.log("Sent tree.sign response");
      } catch (err) {
        console.error("Failed to process tree.propose:", err);
        socket.emit("tree.reject", {
          custodyId: message.payload.custodyId,
          messageHash: message.payload.messageHash,
          reason: err.message,
        });
        console.log("Sent tree.reject response");
      }
    });
  }

  setupPartyAClient() {
    this.client.on("tree.sign", async (message) => {
      console.log(`\nPartyA received tree.sign response:
    CustodyId: ${message.custodyId}
    MessageHash: ${message.messageHash}
  `);

      this.treeBuilder.addSignature(message.messageHash, message.signature);
      console.log("Added counterparty signature to tree");

      const isFullySigned = this.treeBuilder.isMessageFullySigned(
        message.messageHash
      );
      console.log(`Message is ${isFullySigned ? "fully" : "not fully"} signed`);
    });

    this.client.on("tree.reject", (message) => {
      console.error(`\nTree action rejected for custody ${message.custodyId}:
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

    this.client.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: params.custodyId,
        messageHash,
        signature,
        params,
      },
    });
    console.log("Sent tree.propose to counterparty");
  }

  // Helper method to generate and increment nonce
  generateNonce(isPartyA) {
    // Convert counter to hex, pad to 60 chars (30 bytes)
    const counterHex = this.nonceCounter.toString(16).padStart(62, "0");

    // Prefix with A0 for PartyA or B0 for PartyB
    const prefix = isPartyA ? "a0" : "b0";

    // Increment counter for next use
    this.nonceCounter++;

    // Return full 32 byte nonce
    return "0x" + prefix + counterHex;
  }

  async initiateCustodyFlow(counterpartyAddress, custodyId) {
    console.log("\nInitiating custody flow...");
    this.custodyId = custodyId;

    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 3600;

    // Create custody init message
    const initMessage = {
      type: "custody/init/vanilla",
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: custodyId,
      settlementAddress: this.pSymm.address,
      MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
      isManaged: false,
      expiration,
      timestamp,
      nonce: this.generateNonce(true), // We are PartyA
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
          nonce: initMessage.nonce,
        },
      ],
      {
        account: this.walletClient.account,
      }
    );

    console.log("Custody created on-chain");
  }

  async transferCustody(isAdd, amount, counterpartyAddress, custodyId, isA) {
    const transferType = isAdd
      ? "custody/deposit/erc20"
      : "custody/withdraw/erc20";

    console.log("\nInitiating transfer:", transferType);

    const transferMessage = {
      isAdd: isAdd,
      type: transferType,
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: custodyId,
      collateralAmount: amount,
      collateralToken: this.mockSymm.address,
      senderCustodyId:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      nonce: this.generateNonce(isA), // We are PartyA
    };

    // Add message to tree and get initial signature
    const messageHash = await this.treeBuilder.addMessage(transferMessage);
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash },
    });
    this.treeBuilder.addSignature(messageHash, signature);

    // Send to counterparty and wait for their signature
    this.client.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: this.custodyId,
        messageHash,
        signature,
        params: transferMessage,
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

    // Log signatures for debugging
    console.log("Signature A:", signature);
    console.log("Signature B:", counterpartySignature);

    // Ensure signatures are properly formatted hex strings
    const formattedSignatureA = signature.startsWith("0x")
      ? signature
      : `0x${signature}`;
    const formattedSignatureB = counterpartySignature.startsWith("0x")
      ? counterpartySignature
      : `0x${counterpartySignature}`;

    // Now we have both signatures, execute the transfer
    await this.pSymm.write.transferCustody(
      [
        {
          isAdd: isAdd,
          signatureA: formattedSignatureA,
          signatureB: formattedSignatureB,
          partyA: this.address,
          partyB: counterpartyAddress,
          custodyId: this.custodyId,
          collateralAmount: parseEther(amount),
          collateralToken: this.mockSymm.address,
          senderCustodyId: "0x" + "0".repeat(64), // Add missing field
          expiration: Math.floor(Date.now() / 1000) + 3600,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: transferMessage.nonce,
        },
        this.personalCustodyId,
      ],
      {
        account: this.walletClient.account,
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
