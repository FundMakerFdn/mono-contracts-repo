const BaseValidator = require("./BaseValidator");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const {
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog } = require("viem");
const fs = require("fs");

class DeploymentValidator extends BaseValidator {
  constructor(publicClient, walletClient, contracts, config) {
    super(publicClient, walletClient, contracts, config);
    this.newBatchMetadataId = null;
  }

  async start() {
    // Set up event subscriptions before calling parent start
    await this.subscribeToValidatorEvents();

    // Call parent start method
    await super.start();
  }

  async addSettlement(settlementId, settlementContract) {
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

    // Get or create Set for this contract
    if (!this.settlementsByContract.has(settlementContract)) {
      this.settlementsByContract.set(settlementContract, new Set());
    }
    this.settlementsByContract.get(settlementContract).add(settlementId);
    console.log(
      `Added settlement ${settlementId} from contract ${settlementContract}`
    );
  }

  resetBatchState() {
    this.settlementsByContract.clear();
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
          await this.addSettlement(settlementId, event.args.settlementContract);
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

    // Process any settlements in queue
    await super.handleSettlementState();
  }

  async evaluateSettlement(settlementContract, settlementId) {
    console.log(`Evaluating settlement ${settlementId} from contract ${settlementContract}`);
    // For now, always return true as specified
    return true;
  }

  async handleVotingState() {
    if (this.hasVoted || !this.newBatchMetadataId) return;

    // First evaluate all settlements
    await super.handleVotingState();

    // Only proceed if we still have valid settlements after evaluation
    if (this.settlementsByContract.size === 0) {
      console.log("No valid settlements after evaluation");
      return;
    }

    // Construct merkle tree from all valid settlements
    const entries = [];
    for (const [, settlementSet] of this.settlementsByContract) {
      for (const settlementId of settlementSet) {
        entries.push([settlementId]);
      }
    }

    if (entries.length === 0) {
      console.log("No settlements to include in merkle tree");
      return;
    }

    const merkleTree = StandardMerkleTree.of(entries, ["bytes32"]);

    // Verify merkle proof for batch metadata settlement
    const proof = merkleTree.getProof([this.newBatchMetadataId]);
    const isValid = merkleTree.verify([this.newBatchMetadataId], proof);
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
        merkleRoot: merkleTree.root,
        batchMetadataSettlement: this.newBatchMetadataId,
        otherSettlements: Array.from(entries),
        batch: Number(this.currentBatch),
      });

    // Submit soft fork and wait for VoteCast event
    const tx = await this.contracts.settleMaker.write.submitSoftFork(
      [merkleTree.root, storageHash, this.newBatchMetadataId, proof],
      { account: this.walletClient.account }
    );

    // Verify vote was cast
    if (await this.verifyVoteCast(tx, merkleTree.root)) {
      console.log(`Submitted soft fork with root: ${merkleTree.root}`);
      console.log("Batch metadata settlement:", this.newBatchMetadataId);
      console.log("All settlements:", entries);

      this.hasVoted = true;
      console.log(`Vote confirmed for root: ${merkleTree.root}`);
    } else {
      console.error("Failed to verify vote cast");
    }
  }

  async verifyVoteCast(txHash, expectedRoot) {
    // Wait for receipt and verify VoteCast event
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Find VoteCast event in logs
    const voteCastLog = receipt.logs.find((log) => {
      try {
        const event = decodeEventLog({
          abi: this.contracts.settleMaker.abi,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "VoteCast";
      } catch {
        return false;
      }
    });

    if (!voteCastLog) {
      console.error("VoteCast event not found in transaction receipt");
      return false;
    }

    // Decode VoteCast event to verify details
    const voteCastEvent = decodeEventLog({
      abi: this.contracts.settleMaker.abi,
      data: voteCastLog.data,
      topics: voteCastLog.topics,
    });

    // Verify the vote was cast for our merkle root
    if (voteCastEvent.args.softForkRoot !== expectedRoot) {
      console.error("VoteCast event has incorrect softForkRoot");
      return false;
    }

    return true;
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

    // Execute batch metadata settlement
    // Reconstruct merkle tree from stored data to get proof
    const merkleTree = StandardMerkleTree.of(
      storageData.data.otherSettlements,
      ["bytes32"]
    );
    const proof = merkleTree.getProof([this.newBatchMetadataId]);

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
