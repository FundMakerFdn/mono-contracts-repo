const BaseValidator = require('./BaseValidator');
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { time } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog } = require("viem");

class DeploymentValidator extends BaseValidator {
  constructor(
    publicClient,
    walletClient,
    contracts,
    config,
    isMainValidator = false
  ) {
    super(publicClient, walletClient, contracts, config, isMainValidator);
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

    const settlementId = await this.getSettlementIdFromReceipt(
      tx,
      this.contracts.batchMetadata
    );
    this.pendingSettlementId = settlementId;

    console.log(`Created new batch metadata settlement: ${settlementId}`);
  }

  async handleVotingState() {
    if (this.hasVoted) return;

    if (this.pendingSettlementId) {
      const merkleTree = StandardMerkleTree.of(
        [[this.pendingSettlementId]],
        ["bytes32"]
      );

      const storageHash = "0x" + this.storage.store({
        timestamp: Date.now(),
        merkleRoot: merkleTree.root,
        settlements: [this.pendingSettlementId],
        batch: Number(this.currentBatch),
        batchMetadataSettlementId: this.pendingSettlementId,
      });

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

      await this.contracts.settleMaker.write.castVote([merkleTree.root], {
        account: this.walletClient.account,
      });

      this.hasVoted = true;
      console.log(`Voted for root: ${merkleTree.root}`);

      this.pendingSettlementId = null;
    }
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

    const batchMetadataId = storageData.data.batchMetadataSettlementId;
    const merkleTree = StandardMerkleTree.of([[batchMetadataId]], ["bytes32"]);
    const proof = merkleTree.getProof([batchMetadataId]);

    await this.contracts.batchMetadata.write.executeSettlement(
      [BigInt(batch), batchMetadataId, proof],
      { account: this.walletClient.account }
    );

    console.log(`Executed batch metadata settlement for batch ${batch}`);
    console.log("Ready for next cycle");
  }

  async getSettlementIdFromReceipt(txHash, settlement) {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    const log = receipt.logs.find((log) => {
      try {
        const event = decodeEventLog({
          abi: settlement.abi,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "SettlementCreated";
      } catch {
        return false;
      }
    });

    if (!log) {
      throw new Error("Settlement creation event not found");
    }

    const event = decodeEventLog({
      abi: settlement.abi,
      data: log.data,
      topics: log.topics,
    });

    return event.args.settlementId;
  }
}

module.exports = DeploymentValidator;
