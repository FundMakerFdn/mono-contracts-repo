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
