const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const MockStorage = require("./storage/mockStorage");
const {
  time,
} = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog, toHex, keccak256 } = require("viem");

class BaseValidator {
  constructor(publicClient, walletClient, contracts, config) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contracts = contracts;
    this.config = config;
    this.storage = new MockStorage();
    this.currentBatch = 0;
    this.hasVoted = false;
    this.lastState = null;
    this.hasActedInState = false;
    this.pendingSettlementId = null;
    this.shouldStop = false;
    this.unwatchFunctions = [];
    this.settlementQueue = [];
    this.isProcessingQueue = false;
    this.evaluationTimeout = 5 * 60 * 1000; // in ms
  }

  async start() {
    this.currentBatch = Number(
      await this.contracts.settleMaker.read.currentBatch()
    );
    console.log(`Starting with batch ${this.currentBatch}`);

    await this.setupPolling();
    await this.checkStateAndAct();
  }

  async setupPolling() {
    await this.pollNextState();
  }

  async pollNextState() {
    if (this.shouldStop) return;

    try {
      const state = Number(
        await this.contracts.settleMaker.read.getCurrentState()
      );
      const metadata =
        await this.contracts.settleMaker.read.currentBatchMetadata();

      if (state === 3) {
        console.log("Waiting 1 second for voting end state check...");
        setTimeout(async () => {
          if (this.shouldStop) return;
          const newState = Number(
            await this.contracts.settleMaker.read.getCurrentState()
          );
          if (newState !== state) await this.checkStateAndAct();
          await this.pollNextState();
        }, 1000);
        return;
      }

      let nextStateTime;
      switch (state) {
        case 0:
          nextStateTime = Number(metadata.settlementStart);
          break;
        case 1:
          nextStateTime = Number(metadata.votingStart);
          break;
        case 2:
          nextStateTime = Number(metadata.votingEnd);
          break;
        default:
          throw new Error(`Invalid state: ${state}`);
      }

      const now = Math.floor(await time.latest());
      const waitTime = Math.max(0, (nextStateTime - now) * 1000 + 1000);

      console.log(`Waiting ${waitTime}ms until next state...`);
      setTimeout(async () => {
        if (this.shouldStop) return;
        await this.checkStateAndAct();
        await this.pollNextState();
      }, waitTime);
    } catch (error) {
      if (!this.shouldStop) {
        console.error("Error in pollNextState:", error);
        console.log("Error occurred, retrying in 1 second...");
        setTimeout(() => this.pollNextState(), 1000);
      }
    }
  }

  async checkStateAndAct() {
    const newBatch = Number(
      await this.contracts.settleMaker.read.currentBatch()
    );

    if (newBatch !== this.currentBatch) {
      console.log(`New batch cycle: ${this.currentBatch} -> ${newBatch}`);
      this.currentBatch = newBatch;
      this.hasVoted = false;
      this.hasActedInState = false;
      this.pendingSettlementId = null;
      this.lastState = null;
    }

    const state = Number(
      await this.contracts.settleMaker.read.getCurrentState()
    );

    if (state !== this.lastState) {
      this.hasActedInState = false;
      this.lastState = state;
    }

    if (this.hasActedInState) {
      return;
    }

    console.log(`Acting in state: ${state} (Batch ${this.currentBatch})`);

    switch (state) {
      case 0:
        await this.handlePauseState();
        break;
      case 1:
        await this.handleSettlementState();
        break;
      case 2:
        await this.handleVotingState();
        break;
      case 3:
        await this.handleVotingEndState();
        break;
    }

    this.hasActedInState = true;
  }

  // Default handlers that do nothing - to be overridden by subclasses
  async handlePauseState() {
    console.log("Base: Doing nothing in PAUSE state");
  }

  async handleSettlementState() {
    // Just collect settlements during settlement state
    console.log("Base: Collecting settlements in SETTLEMENT state");
  }

  async processSettlementQueue() {
    if (this.isProcessingQueue || this.settlementQueue.length === 0) return;

    this.isProcessingQueue = true;
    const settlementId = this.settlementQueue.shift();

    try {
      const result = await Promise.race([
        this.evaluateSettlement(settlementId),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Evaluation timeout")),
            this.evaluationTimeout
          )
        ),
      ]);

      if (result) {
        console.log(`Settlement ${settlementId} evaluation APPROVE`);
      } else {
        console.log(`Settlement ${settlementId} evaluation REJECT`);
        // Remove from merkle tree if failed
        const newEntries = Array.from(this.newMerkleTree.entries()).filter(
          ([, value]) => value[0] !== settlementId
        );
        if (newEntries.length > 0) {
          this.newMerkleTree = StandardMerkleTree.of(newEntries, ["bytes32"]);
        } else {
          this.newMerkleTree = null;
        }
      }
    } catch (error) {
      console.log(`Settlement ${settlementId} rejected: ${error.message}`);
      // Remove from merkle tree on timeout
      const newEntries = Array.from(this.newMerkleTree.entries()).filter(
        ([, value]) => value[0] !== settlementId
      );
      if (newEntries.length > 0) {
        this.newMerkleTree = StandardMerkleTree.of(newEntries, ["bytes32"]);
      } else {
        this.newMerkleTree = null;
      }
    }

    this.isProcessingQueue = false;
    // Process next in queue
    await this.processSettlementQueue();
  }

  // Base evaluation that subclasses should override
  async evaluateSettlement(settlementId) {
    console.log(`Base evaluation for settlement ${settlementId}`);
    return true; // Default implementation accepts all settlements
  }

  async handleVotingState() {
    if (this.newMerkleTree) {
      console.log("Evaluating collected settlements...");
      const entries = Array.from(this.newMerkleTree.entries());
      for (const [, value] of entries) {
        this.settlementQueue.push(value[0]); // value[0] contains the settlement ID
      }
      await this.processSettlementQueue();
    }
  }

  async handleVotingEndState() {
    console.log("Base: Doing nothing in VOTING_END state");
  }

  stop() {
    this.shouldStop = true;
    // Unsubscribe from all events
    if (this.unwatchFunctions) {
      this.unwatchFunctions.forEach((unwatch) => unwatch());
    }
    this.storage.close();
  }

  async subscribeToEvents(contractName, eventName, callback) {
    if (!this.contracts[contractName]) {
      throw new Error(`Contract ${contractName} not found`);
    }

    const unwatch = await this.publicClient.watchContractEvent({
      address: this.contracts[contractName].address,
      abi: this.contracts[contractName].abi,
      eventName: eventName,
      onLogs: (logs) => {
        logs.forEach((log) => {
          try {
            const event = decodeEventLog({
              abi: this.contracts[contractName].abi,
              data: log.data,
              topics: log.topics,
            });
            callback(event, log);
          } catch (error) {
            console.error(`Error processing ${eventName} event:`, error);
          }
        });
      },
      pollingInterval: 1000, // 1 second in milliseconds
    });

    this.unwatchFunctions.push(unwatch);
    console.log(
      `Subscribed to ${eventName} events on ${contractName} (polling every 1s)`
    );
    return unwatch;
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

module.exports = BaseValidator;
