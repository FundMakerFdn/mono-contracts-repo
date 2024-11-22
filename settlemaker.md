# SettleMaker development plan

## 1. Constructor accepting the following:

- editSettlementAddress: a settlement for changing native settlements' contract addresses (validator, batch metadata)
  - Should be deployed before SettleMaker
  - Can be also replaced later through voting
  - Should require that newSettlement implements ISettlement using EIP-165
  - Assume validators will not vote for malicious contracts / if contract won the vote, it is not malicious
- initial Merkle root with adding settlement types, validator whitelists, next batch metadata settlement

SYMM logic is managed by settlements.

## 2. Contract state variables:

(initial - on contract deployment)

- struct currentBatchMetadata with settlementStart, votingStart, votingEnd, all 0 by default.
- batchSoftFork = mapping(uint256 batchNumber => bytes32 merkleRoot) - applied soft fork per batchNumber
- votes = mapping(bytes32 softForkRoot => uint256 voteCount)
- hasVoted = mapping(address validator => mapping(bytes32 softForkRoot => bool))
- currentBatchWinner = bytes32 softForkRoot. Get vote count from votes[currentBatchWinner]
- editSettlementAddress (more in 2.1.)

No explicit state storing - use a pure function instead:

```solidity
function getCurrentState() public view returns (StateEnum) {
    // timestamps are fetched from editSettlementAddress.batchMetadataSettlementAddress
    if (block.timestamp > votingEnd) return StateEnum.VOTING_END;
    if (block.timestamp > votingStart) return StateEnum.VOTING;
    if (block.timestamp > settlementStart) return StateEnum.SETTLEMENT;
    return StateEnum.PAUSE; // block.timestamp < settlementStart
}
```

If getCurrentState() == StateEnum.VOTING_END, finalizeBatchWinner should be called to apply new batch metadata.

## 2.1. editSettlementAddress

Store only editSettlementAddress in the SettleMaker state. If we want to make it mutable:

- create a setter in SettleMaker:
  - if msg.sender == editSettlementAddress, editSettlementAddress = newValue
- executeSettlement of IEditSettlement:
  - (do usual merkle proof checks)
  - `if (newEditSettlement != address(this)) settleMakerAddress.setEditSettlement(newEditSettlement)`

Other native settlements' addresses are stored in EditSettlement contract itself:

- To access validator registry:
  - `IValidatorSettlement(IEditSettlement(editSettlementAddress).validatorSettlementAddress).verifyValidator(address)`
  - Create a view function for readability
- Same for batchMetadata
- Maybe rename editSettlement to have a more descriptive name?

This architecture would require users to (permissionlessly) execute native settlements one by one - most importantly, batchMetadata.

## 3. SettleMaker deployment:

- Deploy settlement contracts
- Prepare settlements:
  - Create edit settlement to set validatorSettlementAddress and batchMetadataSettlementAddress
  - Create whitelist settlements in validatorSettlementAddress contract to ValidatorSettlement contract
  - Create batch metadata settlement to batchMetadataSettlementAddress
- Initial merkle root should contain:
  - edit settlements to add validator and batchmetadata settlements
  - validator settlements
  - batchmetadata settlement

### 3.1 Settlement:

Each Settlement contract stores all settlements in a single contract instance.

```solidity
function executeSettlement(uint256 batchNumber, bytes32 settlementId, bytes32[] merkleProof) public
```

For regular settlements: Should check if settlement is included in batchSoftFork[batchNumber] using merkleProof

NextBatchMetadata settlement should verify that `settlementStart < votingStart < votingEnd`.

## 4. Settlement state:

- Anyone can submit settlements (stored in respective settlement contracts)
- Early agreements and instant withdraws can happen

Settlement > voting state transition is done by `_verifyUpdateState()` (defined at #8), added for each state-sensetive function.

## 5. Voting state:

- Anyone can propose VALID soft forks (check in submitSoftFork):
- Should include 1 BatchMetadataSettlement
  - newSettlementStart > current votingEnd
- To check that, pass soft fork root, merkle proof & id of batch metadata settlement

- Validators can call castVote, modifyVote (incentivised by rewards for good votes)
- on castVote,
  - `require(getCurrentState() == StateEnum.VOTING, "Invalid state");`
  - Check if msg.sender is validator
  - `require(!hasVoted[msg.sender][softForkRoot], "already voted");`
  - `hasVoted[msg.sender][softForkRoot] = true;`
  - `votes[softForkRoot]++;`
  - compare voted softFork with currentBatchWinner, replace if needed

Voting > settlement state transition is done by finalizeBatchWinner

TODO: modifyVote

## 6. Pause state:

All SettleMaker functions revert until block.timestamp reaches settlementStart.

## 7. After voting state:

Anyone can call finalizeBatchWinner:

```solidity
finalizeBatchWinner() public
```

Which would:

- `require(batchNumber == currentBatch, "Invalid batch number");`
- `require(getCurrentState() == StateEnum.VOTING_END, "Invalid state");`
- Update state:
  - `batchSoftFork[currentBatch] = softForkRoot;`
  - `delete currentBatchWinner;`
  - `delete hasVoted;` - for now; for rewards system, keep
  - `currentBatch++;`
- Validators should execute native settlements separately to update batch metadata / edit validator registry.
- Settlement contracts should check if the settlement is included into the approved soft fork

After calling finalizeBatchWinner(), the state is still VOTING_END, until someone calls executeSettlement on editSettlementAddress.batchMetadataSettlementAddress contract.

## 8. For functions:

- Use modifiers for state-sensetive functions

## 9. Rewards:

TODO

- keep hasVoted
