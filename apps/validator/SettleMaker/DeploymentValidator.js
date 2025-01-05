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
  }

  async start() {
    // Call parent start method
    await super.start();
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

  async handleVotingEndState() {
    const hashFinalize =
      await this.contracts.settleMaker.write.finalizeBatchWinner({
        account: this.walletClient.account,
      });
    await this.publicClient.waitForTransactionReceipt({ hash: hashFinalize });

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

    const hashMetadataExec =
      await this.contracts.batchMetadataSettlement.write.executeSettlement(
        [BigInt(batch), this.newBatchMetadataId, proof],
        { account: this.walletClient.account }
      );
    await this.publicClient.waitForTransactionReceipt({
      hash: hashMetadataExec,
    });
    console.log(
      `Executed batch metadata settlement: ${this.newBatchMetadataId}`
    );

    this.resetBatchState();

    console.log("Ready for next cycle");
  }
}

module.exports = DeploymentValidator;
