const BaseValidator = require("./BaseValidator");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const {
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog } = require("viem");
const fs = require('fs');

class DeploymentValidator extends BaseValidator {
  constructor(publicClient, walletClient, contracts, config) {
    super(publicClient, walletClient, contracts, config);

    // Single source of truth for new settlements
    this.newMerkleTree = null;
    this.newBatchMetadataId = null;
  }

  async start() {
    // Set up event subscriptions before calling parent start
    await this.subscribeToValidatorEvents();

    // Call parent start method
    await super.start();
  }

  async addSettlement(settlementId) {
    // Only add settlements during settlement period (state 1)
    const currentState = Number(
      await this.contracts.settleMaker.read.getCurrentState()
    );
    if (currentState !== 1) {
      console.log(
        `Cannot add settlement ${settlementId} - not in settlement period`
      );
      return;
    }

    const entries = [];
    if (this.newMerkleTree) {
      for (const [, value] of this.newMerkleTree.entries()) {
        entries.push(value);
      }
    }
    entries.push([settlementId]);
    this.newMerkleTree = StandardMerkleTree.of(entries, ["bytes32"]);
    console.log(`Added settlement ${settlementId} to merkle tree`);
  }

  getCurrentSettlements() {
    return Array.from(this.newMerkleTree.entries()).map((e) => e[1]);
  }

  resetBatchState() {
    this.newMerkleTree = null;
    this.newBatchMetadataId = null;
    this.hasVoted = false;
    console.log("Reset batch state");
  }

  async stop() {
    // Call parent stop first
    super.stop();

    // Remove temp file
    try {
      fs.unlinkSync(this.config.contractsTempFile);
      console.log("Removed temporary contracts file");
    } catch (err) {
      console.error("Error removing temp file:", err);
    }
  }

  async subscribeToValidatorEvents() {
    await this.subscribeToEvents(
      "validatorSettlement",
      "SettlementCreated",
      async (event, log) => {
        const settlementId = event.args.settlementId;

        // Get validator parameters for this settlement
        const params =
          await this.contracts.validatorSettlement.read.getValidatorParameters([
            settlementId,
          ]);

        console.log("New validator settlement created:", {
          settlementId: settlementId,
          creator: event.args.creator,
          settlementContract: event.args.settlementContract,
          params,
        });

        // Queue settlement to be added during settlement period
        const currentState = Number(
          await this.contracts.settleMaker.read.getCurrentState()
        );
        if (currentState === 1) {
          await this.addSettlement(settlementId);
        } else {
          console.log(
            `Settlement ${settlementId} created outside settlement period - will not be added`
          );
        }
      }
    );
  }

  async handleSettlementState() {
    const currentTimestamp = BigInt(await time.latest());
    const settlementStart =
      currentTimestamp + BigInt(this.config.settleMaker.settlementDelay);
    const votingStart =
      settlementStart + BigInt(this.config.settleMaker.settlementDuration);
    const votingEnd =
      votingStart + BigInt(this.config.settleMaker.votingDuration);

    const tx =
      await this.contracts.batchMetadata.write.createBatchMetadataSettlement(
        [settlementStart, votingStart, votingEnd],
        { account: this.walletClient.account }
      );

    const settlementId = await super.getSettlementIdFromReceipt(
      tx,
      this.contracts.batchMetadata
    );

    // Store batch metadata ID and add to merkle tree
    this.newBatchMetadataId = settlementId;
    await this.addSettlement(settlementId);

    console.log(`Created new batch metadata settlement: ${settlementId}`);
  }

  async handleVotingState() {
    if (this.hasVoted || !this.newMerkleTree || !this.newBatchMetadataId)
      return;

    // Verify merkle proof for batch metadata settlement
    const proof = this.newMerkleTree.getProof([this.newBatchMetadataId]);
    const isValid = this.newMerkleTree.verify([this.newBatchMetadataId], proof);
    if (!isValid) {
      console.error(
        `Invalid merkle proof for batch metadata settlement ${this.newBatchMetadataId}`
      );
      return;
    }

    const storageHash =
      "0x" +
      this.storage.store({
        timestamp: Date.now(),
        merkleRoot: this.newMerkleTree.root,
        batchMetadataSettlement: this.newBatchMetadataId,
        otherSettlements: this.getCurrentSettlements(),
        batch: Number(this.currentBatch),
      });

    // Submit soft fork and vote in one clear flow
    await this.contracts.settleMaker.write.submitSoftFork(
      [this.newMerkleTree.root, storageHash, this.newBatchMetadataId, proof],
      { account: this.walletClient.account }
    );

    console.log(`Submitted soft fork with root: ${this.newMerkleTree.root}`);
    console.log("Batch metadata settlement:", this.newBatchMetadataId);
    console.log("All settlements:", this.getCurrentSettlements());

    await this.contracts.settleMaker.write.castVote([this.newMerkleTree.root], {
      account: this.walletClient.account,
    });

    this.hasVoted = true;
    console.log(`Voted for root: ${this.newMerkleTree.root}`);
  }

  async handleVotingEndState() {
    await this.contracts.settleMaker.write.finalizeBatchWinner({
      account: this.walletClient.account,
    });

    const batch = this.currentBatch;
    console.log(`Finalized batch ${batch}`);

    const winningRoot = await this.contracts.settleMaker.read.batchSoftFork([
      BigInt(batch),
    ]);
    const dataHash = await this.contracts.settleMaker.read.softForkDataHashes([
      winningRoot,
    ]);

    const storageData = this.storage.get(dataHash.slice(2));
    if (!storageData) {
      console.error("Could not find storage data for hash:", dataHash);
      return;
    }

    // Only execute batch metadata settlement
    const proof = this.newMerkleTree.getProof([this.newBatchMetadataId]);

    await this.contracts.batchMetadata.write.executeSettlement(
      [BigInt(batch), this.newBatchMetadataId, proof],
      { account: this.walletClient.account }
    );
    console.log(
      `Executed batch metadata settlement: ${this.newBatchMetadataId}`
    );

    this.resetBatchState();

    console.log("Ready for next cycle");
  }
}

module.exports = DeploymentValidator;
