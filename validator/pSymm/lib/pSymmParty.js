const { Server } = require("socket.io");
const { io } = require("socket.io-client");
const CustodyRollupTreeBuilder = require("./custodyRollupTreeBuilder");
const { parseEther } = require("viem");

class PSymmParty {
  constructor(config) {
    this.address = config.address;
    this.port = config.port;
    this.counterpartyUrl = config.counterpartyUrl;
    this.walletClient = config.walletClient;
    this.pSymm = config.pSymm;
    this.mockSymm = config.mockSymm;

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

      this.client = io(this.counterpartyUrl);
      this.setupClient();
    } catch (err) {
      console.error(`Failed to start server on port ${this.port}:`, err);
      throw err;
    }
  }

  setupServer() {
    this.server.on("connection", (socket) => {
      console.log("Client connected");

      socket.on("tree.propose", async (message) => {
        console.log(`\nReceived tree.propose action:
    Type: ${message.payload.params.type}
    From: ${message.payload.params.partyA}
    CustodyId: ${message.payload.custodyId}
  `);

        try {
          const messageHash = await this.treeBuilder.addMessage(
            message.payload.params
          );
          console.log(`Added message to tree with hash: ${messageHash}`);

          const signature = await this.walletClient.signMessage({
            message: messageHash,
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
    });
  }

  setupClient() {
    this.client.on("connect", () => {
      console.log(`\nConnected to counterparty at ${this.counterpartyUrl}`);
    });

    this.client.on("disconnect", () => {
      console.log("\nDisconnected from counterparty");
    });

    this.client.on("tree.sign", async (message) => {
      console.log(`\nReceived tree.sign response:
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
    console.log(`\nInitiating deposit of ${amount} tokens...`);

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
      [
        this.mockSymm.address,
        parseEther(amount),
        1, // custodyId
      ],
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
      message: messageHash,
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

  async initiateCustodyFlow(counterpartyAddress) {
    console.log("\nInitiating custody flow...");

    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + 3600;

    // Create custody init message
    const initMessage = {
      type: "custody/init/vanilla",
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: 1,
      settlementAddress: this.pSymm.address,
      MA: "0x0000000000000000000000000000000000000000000000000000000000000000",
      isManaged: false,
      expiration,
      timestamp,
      nonce:
        "0xA000000000000000000000000000000000000000000000000000000000000000",
    };

    // Get message hash and sign it directly
    const messageHash = await this.treeBuilder.addMessage(initMessage);
    const signature = await this.walletClient.signMessage({
      message: messageHash,
    });

    // Add our signature to the tree
    this.treeBuilder.addSignature(messageHash, signature);

    // Send to counterparty with domain and types
    this.client.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: "1",
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
          custodyId: 1,
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

  async transferToCustody(amount, counterpartyAddress) {
    console.log("\nInitiating transfer to custody...");

    const transferMessage = {
      type: "custody/deposit/erc20",
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: "1",
      collateralAmount: amount,
      collateralToken: this.mockSymm.address,
      expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      nonce:
        "0xA100000000000000000000000000000000000000000000000000000000000000",
    };

    // Add message to tree and get initial signature
    const messageHash = await this.treeBuilder.addMessage(transferMessage);
    const signature = await this.walletClient.signMessage({
      message: messageHash,
    });
    this.treeBuilder.addSignature(messageHash, signature);

    // Send to counterparty and wait for their signature
    this.client.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: "1",
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
    await this.pSymm.write.transferToCustody(
      [
        {
          signatureA: formattedSignatureA,
          signatureB: formattedSignatureB,
          partyA: this.address,
          partyB: counterpartyAddress,
          custodyId: 1,
          collateralAmount: parseEther(amount),
          collateralToken: this.mockSymm.address,
          senderCustodyId: "0x" + "0".repeat(64), // Add missing field
          expiration: Math.floor(Date.now() / 1000) + 3600,
          timestamp: Math.floor(Date.now() / 1000),
          nonce: transferMessage.nonce,
        },
        1, // senderCustodyId
      ],
      {
        account: this.walletClient.account,
      }
    );
  }

  async closeCustody(amount, counterpartyAddress) {
    console.log("\nInitiating custody closure...");

    const closeMessage = {
      type: "custody/withdraw/erc20",
      partyA: this.address,
      partyB: counterpartyAddress,
      custodyId: "1",
      collateralAmount: amount,
      collateralToken: this.mockSymm.address,
      expiration: (Math.floor(Date.now() / 1000) + 3600).toString(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
      nonce:
        "0xA200000000000000000000000000000000000000000000000000000000000000",
    };

    const messageHash = await this.treeBuilder.addMessage(closeMessage);
    const signature = await this.walletClient.signMessage({
      message: messageHash,
    });
    this.treeBuilder.addSignature(messageHash, signature);

    this.client.emit("tree.propose", {
      type: "tree.propose",
      payload: {
        custodyId: "1",
        messageHash,
        signature,
        params: closeMessage,
      },
    });
  }

  async withdraw(amount) {
    console.log(`\nInitiating withdrawal of ${amount} tokens...`);

    console.log("Executing withdrawal transaction...");
    await this.pSymm.write.withdraw(
      [
        this.mockSymm.address,
        parseEther(amount),
        1, // custodyId
      ],
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
