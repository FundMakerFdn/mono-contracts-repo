const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const MockStorage = require("./storage/mockStorage");
const {
  time,
  mine,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog, toHex, keccak256, hexToBytes } = require("viem");

class Validator {
  constructor(
    publicClient,
    walletClient,
    contracts,
    config,
    isMainValidator = false
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contracts = contracts; // { settleMaker, batchMetadata, etc }
    this.config = config;
    this.isMainValidator = isMainValidator;
    this.storage = new MockStorage();
    this.currentBatch = 0n;
    this.hasVoted = false;
    this.lastState = null;
    this.hasActedInState = false;
    this.pendingSettlementId = null;
  }

  async start() {
    if (!this.isMainValidator) {
      console.log("Not a main validator, exiting...");
      return;
    }

    console.log("Starting main validator...");

    // Get current batch
    this.currentBatch = await this.contracts.settleMaker.read.currentBatch();

    // Set up polling
    await this.setupPolling();

    // Initial state check
    await this.checkStateAndAct();
  }

  async setupPolling() {
    // Poll every 500ms
    this.pollInterval = setInterval(async () => {
      await this.checkStateAndAct();
    }, 500);
  }

  async checkStateAndAct() {
    // Get and log current batch metadata
    const state = Number(
      await this.contracts.settleMaker.read.getCurrentState()
    );
    console.log(`Current state: ${state}`);

    // Only act if state changed or we haven't acted in this state yet
    if (state === this.lastState && this.hasActedInState) {
      return;
    }

    console.log(`Current state: ${state}`);
    this.lastState = state;
    this.hasActedInState = false;

    switch (state) {
      case 1: // SETTLEMENT
        await this.handleSettlementState();
        break;
      case 2: // VOTING
        await this.handleVotingState();
        break;
      case 3: // VOTING_END
        await this.handleVotingEndState();
        break;
    }

    this.hasActedInState = true;
  }

  async handleSettlementState() {
    // 1. Propose next batch metadata
    const currentTimestamp = BigInt(await time.latest());
    const settlementStart =
      currentTimestamp + BigInt(this.config.settlementDelay);
    const votingStart =
      settlementStart + BigInt(this.config.settlementDuration);
    const votingEnd = votingStart + BigInt(this.config.votingDuration);

    const tx =
      await this.contracts.batchMetadata.write.createBatchMetadataSettlement(
        [settlementStart, votingStart, votingEnd],
        { account: this.walletClient.account }
      );

    const settlementId = await this.getSettlementIdFromReceipt(
      tx,
      this.contracts.batchMetadata
    );

    // Store settlement ID for later use in voting state
    this.pendingSettlementId = settlementId;
  }

  async handleVotingState() {
    if (this.hasVoted) return;

    // Create and submit soft fork if we have a pending settlement
    if (this.pendingSettlementId) {
      // Create merkle tree with the settlement
      const merkleTree = StandardMerkleTree.of(
        [[this.pendingSettlementId]],
        ["bytes32"]
      );

      // Store merkle tree data with batchMetadataSettlementId separately
      const storageHash =
        "0x" +
        this.storage.store({
          timestamp: Date.now(),
          merkleRoot: merkleTree.root,
          settlements: [this.pendingSettlementId],
          batch: Number(this.currentBatch),
          batchMetadataSettlementId: this.pendingSettlementId
        });

      // Submit soft fork
      await this.contracts.settleMaker.write.submitSoftFork(
        [
          merkleTree.root,
          storageHash,
          this.pendingSettlementId,
          merkleTree.getProof([this.pendingSettlementId]),
        ],
        { account: this.walletClient.account }
      );

      console.log(`Submitted soft fork with root: ${merkleTree.root}`);

      // Immediately cast vote on our soft fork
      await this.contracts.settleMaker.write.castVote([merkleTree.root], {
        account: this.walletClient.account,
      });

      this.hasVoted = true;
      console.log(`Voted for root: ${merkleTree.root}`);

      // Clear pending settlement
      this.pendingSettlementId = null;
    }
  }

  async handleVotingEndState() {
    // Call finalize if not already finalized
    const currentBatchFromContract =
      await this.contracts.settleMaker.read.currentBatch();
    if (currentBatchFromContract === this.currentBatch) {
      await this.contracts.settleMaker.write.finalizeBatchWinner({
        account: this.walletClient.account,
      });
      console.log("Finalized batch winner");
    }
  }

  async getSettlementIdFromReceipt(txHash, settlement) {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    const SETTLEMENT_CREATED_EVENT = keccak256(
      toHex("SettlementCreated(bytes32,address,address)")
    );
    const settlementCreatedEvent = receipt.logs.find(
      (log) => log.topics[0] === SETTLEMENT_CREATED_EVENT
    );
    const decodedLog = decodeEventLog({
      abi: settlement.abi,
      eventName: "SettlementCreated",
      topics: settlementCreatedEvent.topics,
      data: settlementCreatedEvent.data,
    });

    return decodedLog.args.settlementId;
  }

  getLatestStorageData() {
    // Implementation depends on how you want to track latest hash
    // This is just an example
    return null;
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    // Cleanup storage
    this.storage.close();
  }
}

module.exports = Validator;
