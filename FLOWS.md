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
   - Party A calls offchain(broadcastEarlyAgreement) with unsigned proposal
   - Party B calls offchain(respondToEarlyAgreement) with unsigned acceptance
   - Party A signs EIP712 for agreement
   - Party B signs EIP712 accepting agreement
   - Either party calls onchain(executeEarlyAgreement) with both signatures

## Validator Registry flow

Parties involved: Validators

1. OFFCHAIN: Each period, Validators:

   - Generate validator registry changes as ValidatorRegistryLeaf structs
   - Build merkle tree from changes
   - Submit merkle root via onchain(submitValidatorRegistryBatch)

2. ONCHAIN: Voting process:

   - Validators call onchain(castVote) during voting period
   - After voting period ends, winning merkle determines validator set
   - Any validator can call onchain(executeValidatorRegistryChange) with merkle proofs

3. New validators must:
   - Complete KYC/AML process
   - Meet jurisdiction diversity requirements
   - Receive approval via voting process
   - Have equal vote weight (1) once approved

## RFQ flow

Parties involved: Party A (requester), Solvers

1. Solver calls onchain(registerSolver) with IP address
2. Party A calls offchain(broadcastRFQ) (unsigned) to all solver IPs
3. Solvers call offchain(respondToRFQ) with unsigned quotes (if they want)
4. Party A calls offchain(selectBestQuote), signs EIP712 (or none)
5. Solver calls offchain(acceptRFQ), signs EIP712.
6. Party A calls onchain(executeRFQ) with selected quote

## Soft Fork Periodic Batch flow

Parties involved: Settlement makers, Validators

1. After period ends:

   - Each validator computes the merkle tree for all settlements
   - If a matching merkle already exists, validator votes for it
   - Otherwise, validator submits new merkle via onchain(submitSoftFork)
   - Merkle data is stored on Arweave

2. Validators call onchain(castVote) during 3-day voting period

   - Validators can call onchain(modifyVote) to change votes
   - TODO: time-weighted average voting

3. After voting period ends:

   - Settlement makers call onchain(executeSettlements) with merkle proofs
   - Validators call onchain(claimVoterRewards) for correct votes

## Instant Withdraw flow

Parties involved: Party wanting to exit, Solver

1. Party calls offchain(requestInstantWithdraw)
2. Solver calls offchain(verifyWithdrawRequest)
3. Solver calls onchain(executeInstantWithdraw) with fee
