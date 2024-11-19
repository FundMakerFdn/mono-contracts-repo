# Settlement process flows

## ETF Settlement flow

Parties involved: Party A (ETF creator), Party B (ETF buyer), Validators

1. Party A calls offchain(prepareETFSettlement) with ETF parameters
2. Party A calls onchain(createSettlement) with collateral
3. If dispute:
   - Validators call onchain(castVote) during voting period
   - After voting period, anyone calls onchain(claimCollateral)
4. If agreed:
   - Both parties call offchain(signEarlyAgreement)
   - Either party calls onchain(executeInstantWithdraw)

## PSymm Settlement flow

Parties involved: Party A (trader), Party B (counterparty), Validators

1. Party A calls offchain(preparePSymmSettlement) with trade parameters
2. Party A calls onchain(createSettlement) with collateral
3. If dispute:
   - Validators call onchain(castVote) during voting period
   - After voting period, anyone calls onchain(claimCollateral)
4. If agreed:
   - Both parties call offchain(signEarlyAgreement)
   - Either party calls onchain(executeInstantWithdraw)

## Cross-Chain Settlement flow

Parties involved: Validators, Settlement makers

1. On main chain:

   - Validators sign EIP191 message containing:
     - Batch ID
     - Merkle root
     - Contract address
     - Chain ID
   - Submit signatures during voting period

2. On other chains:
   - Anyone can submit root with validator signatures
   - Root is accepted when 51% consensus reached
   - 12 hour resolution period if under 51%
   - Malicious submissions can be proven and slashed on main chain

## Validator Registry flow

Parties involved: Validators

1. New validators must:

   - Have required SYMM tokens amount
   - Approve SettleMaker contract to take SYMM tokens
   - Call registerValidator() to lock SYMM and become validator
   - Have equal vote weight (1) once registered

2. To exit validator set:
   - Call removeValidator()
   - Receive back locked SYMM tokens

## Periodic Batch Settlement flow

Parties involved: Settlement makers, Validators

1. After period ends:

   - Each validator computes the merkle tree for all settlements using StandardMerkleTree:
     - Leaf structure: `(settlementId, batchNumber, amountToPartyA, settlementContract, parameters)`
     - `parameters` are ABI encoded based on settlement type
   - Validators sort leaves by settlementId before tree generation
   - For each manual settlement requiring verification:
     - Review dispute evidence and parameters
     - Calculate appropriate amountToPartyA based on settlement rules
   - If a matching merkle exists, validator votes for it
   - Otherwise, validator submits new merkle via onchain(submitSoftFork)

2. Manual Voting Process:

   - All settlements undergo manual review each period
   - Validators review and vote on all proposed resolutions
   - Can modify votes if new evidence emerges

3. After voting period ends:
   - Settlement makers call onchain(executeSettlements) with merkle proofs
   - Validators call onchain(claimValidatorRewards) for correct votes

## Instant Withdraw flow

Parties involved: Party wanting to exit, Solver

1. Party calls offchain(requestInstantWithdraw)
2. Solver calls offchain(verifyWithdrawRequest)
3. Solver calls onchain(executeInstantWithdraw) with fee
