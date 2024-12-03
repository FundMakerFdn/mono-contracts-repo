const BaseValidator = require("./BaseValidator");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const {
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog, getAddress } = require("viem");
const fs = require("fs");

class DeploymentValidator extends BaseValidator {
  constructor(publicClient, walletClient, contracts, config) {
    super(publicClient, walletClient, contracts, config);
    this.newBatchMetadataId = null;
  }

  async start() {
    // Call parent start method
    await super.start();
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

  async handleSettlementState() {
    const currentTimestamp = BigInt(await time.latest());
    const settlementStart =
      currentTimestamp + BigInt(this.config.settleMaker.settlementDelay);
    const votingStart =
      settlementStart + BigInt(this.config.settleMaker.settlementDuration);
    const votingEnd =
      votingStart + BigInt(this.config.settleMaker.votingDuration);

    const tx =
      await this.contracts.batchMetadataSettlement.write.createBatchMetadataSettlement(
        [settlementStart, votingStart, votingEnd],
        { account: this.walletClient.account }
      );

    const settlementId = await super.getSettlementIdFromReceipt(
      tx,
      this.contracts.batchMetadataSettlement
    );

    // Store batch metadata ID and add to map
    this.newBatchMetadataId = settlementId;
    // await this.addSettlementToMap(settlementId, this.contracts.batchMetadataSettlement.address);

    console.log(`Created new batch metadata settlement: ${settlementId}`);

    // Process any settlements in queue
    await super.handleSettlementState();
  }

  async evaluateSettlement(settlementContract, settlementId) {
    // Only do additional checks for validator settlements
    if (
      getAddress(settlementContract) !==
      getAddress(this.contracts.validatorSettlement.address)
    ) {
      return true;
    }

    try {
      // Get validator parameters for this settlement
      const params =
        await this.contracts.validatorSettlement.read.getValidatorParameters([
          settlementId,
        ]);

      // Check if this is an add validator settlement (not a removal)
      if (!params.isAdd) {
        return true; // No balance check needed for removals
      }

      // Get validator's SYMM balance
      const balance = await this.contracts.mockSymm.read.balanceOf([
        params.validator,
      ]);

      // Check if validator has enough SYMM
      if (balance < params.requiredSymmAmount) {
        console.log(
          `Validator ${params.validator} has insufficient SYMM balance`
        );
        console.log(`Required: ${params.requiredSymmAmount}, Has: ${balance}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error evaluating validator settlement:", error);
      return false;
    }
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

    await this.contracts.batchMetadataSettlement.write.executeSettlement(
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
