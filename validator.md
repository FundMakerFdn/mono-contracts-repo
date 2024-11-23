# Native settlement Validator

## Architecture

- Directory: `nativeValidator/'
- Scripts should be aliased through package.json (so we can run `yarn validator deploy` etc)
- Use publicClient.watchContractEvent to get hold of the state changes
- Have a mock Arweave implementation
- From "Use & test" section we see that the system consists of multiple simulatenously running processes

## Mock Arweave-like storage

- Just a wrapper library to SQLite 3 local DB.
- Stores hash-data relation only.

## Setup

- `yarn hardhat node`
- `yarn mockArweave`
- `yarn validator deploy` - deploy contracts, run initial validator
  - each time propose next batch metadata with timings described in its config json
  - castVote on all settlements
  - run finalizeBatchWinner each time, execute native settlements

## Use & test

- `yarn validator run` - run new validator:
  - Wait until it is SETTLEMENT state
  - Propose whitelisting himself
  - Then castVote on all settlements
- `yarn validator addTime SECONDS` - advance time for a new state
