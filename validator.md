# Native settlement Validator

Currently, to test validator setup, the commands below are used:

- `yarn hardhat node` to start a local node
- `yarn hardhat run nativeValidator/deploy.js --network localhost` to deploy contracts

## Architecture

- Directory: `nativeValidator/' - stores EVERYTHING native validator-related
- Scripts should be aliased through package.json (so we can run `yarn validator deploy` etc)
- Use publicClient.watchContractEvent to get hold of the state changes
- Have a mock hashmap storage implementation
- From "Use & test" section we see that the system consists of multiple simulatenously running processes

## Mock Hashmap Storage

- Just a wrapper library to SQLite 3 local DB.
- Stores hash-data relation only.

## Setup

(For now aliases are optional, everything is ran with `yarn hardhat run`)

- `yarn hardhat node`
- `yarn validator deploy` - deploy contracts, run initial validator
  - each time propose next batch metadata with timings described in its config js constant object.
  - castVote on all softForks
  - run finalizeBatchWinner each time, execute native settlements

## Use & test

- `yarn validator run` - run new validator:
  - Wait until it is SETTLEMENT state
  - Propose whitelisting himself
  - Then castVote on all settlements
- `yarn validator addTime SECONDS` - advance time for a new state
