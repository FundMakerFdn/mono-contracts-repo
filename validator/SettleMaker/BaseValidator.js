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
    this.evaluationTimeout = 5 * 60 * 1000; // in ms
    this.settlementsByContract = new Map(); // Map<address, Set<string>>
    this.shouldListenSettlements = false;
    this.newBatchMetadataId = null;
  }

  async subscribeToSettlementEvents() {
    // Subscribe to SettlementCreated events for all settlement contracts
    for (const [name, contract] of Object.entries(this.contracts)) {
      if (name === 'settleMaker' || name === 'mockSymm') continue;
      
      await this.subscribeToEvents(
        name,
        "SettlementCreated", 
        async (event, log) => {
          // Only collect settlements if we've witnessed the settlement state start
          if (!this.shouldListenSettlements) {
            console.log("Ignoring settlement - waiting to witness settlement state start");
            return;
          }

          const settlementId = event.args.settlementId;
          const settlementContract = contract.address;

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
      );
    }
  }

  async start() {
    this.currentBatch = Number(
      await this.contracts.settleMaker.read.currentBatch()
    );
    console.log(`Starting with batch ${this.currentBatch}`);

    await this.subscribeToSettlementEvents();
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
      this.shouldListenSettlements = false; // Reset on new batch
    }

    const state = Number(
      await this.contracts.settleMaker.read.getCurrentState()
    );

    if (state !== this.lastState) {
      this.hasActedInState = false;
      this.lastState = state;
      
      // Set shouldListenSettlements when we see state transition to SETTLEMENT (1)
      if (state === 1) {
        this.shouldListenSettlements = true;
        console.log("Witnessed start of settlement state - will begin collecting settlements");
      }
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

  async calculateAlignedTimestamps() {
    const currentTimestamp = BigInt(await time.latest());
    
    // Get next 15-second aligned timestamp after current time + settlement delay
    const baseTime = currentTimestamp + BigInt(this.config.settleMaker.settlementDelay);
    const secondsIntoMinute = baseTime % 60n;
    const blockNumber = secondsIntoMinute / 15n;
    const nextBlockNumber = blockNumber + 1n;
    const alignedSettlementStart = baseTime + (nextBlockNumber * 15n - secondsIntoMinute);
    
    // Calculate other timestamps based on aligned settlement start
    const alignedVotingStart = alignedSettlementStart + BigInt(this.config.settleMaker.settlementDuration);
    const alignedVotingEnd = alignedVotingStart + BigInt(this.config.settleMaker.votingDuration);

    return {
      settlementStart: alignedSettlementStart,
      votingStart: alignedVotingStart, 
      votingEnd: alignedVotingEnd
    };
  }

  async handleSettlementState() {
    const timestamps = await this.calculateAlignedTimestamps();

    const tx = await this.contracts.batchMetadataSettlement.write.createBatchMetadataSettlement(
      [timestamps.settlementStart, timestamps.votingStart, timestamps.votingEnd],
      { account: this.walletClient.account }
    );

    const settlementId = await this.getSettlementIdFromReceipt(
      tx,
      this.contracts.batchMetadataSettlement
    );

    // Store batch metadata ID and add to map
    this.newBatchMetadataId = settlementId;

    console.log(`Created new batch metadata settlement: ${settlementId}`);
    console.log('Timestamps:');
    console.log(`- Settlement start: ${timestamps.settlementStart} (${new Date(Number(timestamps.settlementStart) * 1000).toISOString()})`);
    console.log(`- Voting start: ${timestamps.votingStart} (${new Date(Number(timestamps.votingStart) * 1000).toISOString()})`);
    console.log(`- Voting end: ${timestamps.votingEnd} (${new Date(Number(timestamps.votingEnd) * 1000).toISOString()})`);
  }

  async evaluateSettlement(settlementContract, settlementId) {
    return true;
  }

  async handleVotingState() {
    if (this.hasVoted || !this.newBatchMetadataId) return;

    console.log("Evaluating collected settlements...");

    // Process settlements directly from the contract map
    for (const [contractAddress, settlementSet] of this.settlementsByContract) {
      for (const settlementId of settlementSet) {
        try {
          const result = await Promise.race([
            this.evaluateSettlement(contractAddress, settlementId),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Evaluation timeout")),
                this.evaluationTimeout
              )
            ),
          ]);

          if (!result) {
            console.log(`Settlement ${settlementId} evaluation REJECT`);
            settlementSet.delete(settlementId);
          } else {
            console.log(`Settlement ${settlementId} evaluation APPROVE`);
          }
        } catch (error) {
          console.log(`Settlement ${settlementId} rejected: ${error.message}`);
          settlementSet.delete(settlementId);
        }
      }

      // Remove contract entry if no settlements remain
      if (settlementSet.size === 0) {
        this.settlementsByContract.delete(contractAddress);
      }
    }

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

  async addSettlementToMap(settlementId, contractAddress) {
    // Get or create Set for this contract
    if (!this.settlementsByContract.has(contractAddress)) {
      this.settlementsByContract.set(contractAddress, new Set());
    }
    this.settlementsByContract.get(contractAddress).add(settlementId);
    console.log(
      `Added settlement ${settlementId} from contract ${contractAddress}`
    );
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
