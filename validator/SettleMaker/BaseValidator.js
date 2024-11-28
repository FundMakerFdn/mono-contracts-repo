const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const MockStorage = require("./storage/mockStorage");
const { time } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { decodeEventLog, toHex, keccak256 } = require("viem");

class BaseValidator {
  constructor(
    publicClient,
    walletClient,
    contracts,
    config,
    isMainValidator = false
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contracts = contracts;
    this.config = config;
    this.isMainValidator = isMainValidator;
    this.storage = new MockStorage();
    this.currentBatch = 0;
    this.hasVoted = false;
    this.lastState = null;
    this.hasActedInState = false;
    this.pendingSettlementId = null;
    this.shouldStop = false;
  }

  async start() {
    if (!this.isMainValidator) {
      console.log("Not a main validator, exiting...");
      return;
    }

    console.log("Starting main validator...");

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
    console.log("Base: Doing nothing in SETTLEMENT state");
  }

  async handleVotingState() {
    console.log("Base: Doing nothing in VOTING state");
  }

  async handleVotingEndState() {
    console.log("Base: Doing nothing in VOTING_END state");
  }

  stop() {
    this.shouldStop = true;
    this.storage.close();
  }
}

module.exports = BaseValidator;
