const BaseValidator = require("./BaseValidator");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { parseEther } = require("viem");

const SEPARATOR = "--------------------";

class Validator extends BaseValidator {
  constructor(publicClient, walletClient, contracts, config) {
    super(publicClient, walletClient, contracts, config);
    this.isWhitelisted = false;
    this.pendingWhitelistId = null;
  }

  async start() {
    // Check if already whitelisted
    this.isWhitelisted = await this.contracts.settleMaker.read.isValidator([
      this.walletClient.account.address,
    ]);

    console.log(SEPARATOR);
    console.log(
      `Validator whitelist status check for ${this.walletClient.account.address}:`
    );
    console.log(this.isWhitelisted ? "Already whitelisted" : "Not whitelisted");
    console.log(SEPARATOR);

    if (!this.isWhitelisted) {
      // Subscribe to batch finalization events
      await this.subscribeToEvents(
        "settleMaker",
        "BatchFinalized",
        this.handleBatchFinalized.bind(this)
      );

      // Try to submit whitelist settlement if in settlement period
      await this.submitWhitelistSettlement();
    }

    // Call parent start method after our initialization
    await super.start();
  }

  // Override handleSettlementState to try submitting whitelist if needed
  async handleSettlementState() {
    if (!this.isWhitelisted && !this.pendingWhitelistId) {
      await this.submitWhitelistSettlement();
    }
  }

  async submitWhitelistSettlement() {
    // Check if we're in settlement period
    const currentState = Number(
      await this.contracts.settleMaker.read.getCurrentState()
    );
    if (currentState !== 1) {
      console.log(
        "Not in settlement period - waiting to submit whitelist settlement"
      );
      return;
    }

    console.log("Submitting validator whitelist settlement...");

    // Create validator whitelist settlement
    const tx =
      await this.contracts.validatorSettlement.write.createValidatorSettlement(
        [
          this.walletClient.account.address,
          parseEther("1000"), // Required SYMM amount
          true, // isAdd = true
        ],
        {
          account: this.walletClient.account,
        }
      );

    const settlementId = await this.getSettlementIdFromReceipt(
      tx,
      this.contracts.validatorSettlement
    );
    this.pendingWhitelistId = settlementId;
    console.log(`Created validator whitelist settlement ${settlementId}`);
  }

  async handleBatchFinalized(event) {
    if (!this.pendingWhitelistId) return;

    const batch = event.args.batchNumber;
    const winningRoot = event.args.winningRoot;

    // Get data hash for winning root
    const dataHash = await this.contracts.settleMaker.read.softForkDataHashes([
      winningRoot,
    ]);

    // Fetch stored data from mock storage
    const storageData = this.storage.get(dataHash.slice(2));
    if (!storageData) {
      console.error("Could not find storage data for hash:", dataHash);
      return;
    }

    // Check if our settlement is included
    const settlements = storageData.data.otherSettlements || [];
    const isIncluded = settlements.some(
      (settlement) => settlement[0] === this.pendingWhitelistId
    );

    console.log(SEPARATOR);
    if (isIncluded) {
      console.log("Whitelist settlement was accepted!");

      // Execute the settlement
      const merkleTree = StandardMerkleTree.of(settlements, ["bytes32"]);
      const proof = merkleTree.getProof([this.pendingWhitelistId]);

      try {
        await this.contracts.validatorSettlement.write.executeSettlement(
          [BigInt(batch), this.pendingWhitelistId, proof],
          { account: this.walletClient.account }
        );
      } catch (error) {
        console.error(
          "Failed to executeSettlement on validator contract - do I have enough SYMM?"
        );
        // console.error("Error details:", error);
        this.pendingWhitelistId = null;
        return;
      }

      // Verify whitelisting was successful
      this.isWhitelisted = await this.contracts.settleMaker.read.isValidator([
        this.walletClient.account.address,
      ]);

      if (this.isWhitelisted) {
        console.log("Successfully whitelisted as validator");
        this.pendingWhitelistId = null;
      }
    } else {
      console.log("Whitelist settlement did not pass the vote");
      this.pendingWhitelistId = null;
    }
    console.log(SEPARATOR);
  }
}

module.exports = Validator;
