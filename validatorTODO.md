# Validator Implementation

## Configuration
Uses timing parameters from `nativeValidator/config.js`:
- SETTLEMENT_DURATION: Time allowed for settlement submissions
- VOTING_DURATION: Time allowed for voting

## Main Function
Takes argument `isMainValidator` (boolean):
- If false: ignore for now
- If true: execute main validator algorithm

## Main/Deployer Validator Algorithm

1. Get current timestamp and calculate batch timing:
   - settlementStart = currentTimestamp
   - votingStart = settlementStart + SETTLEMENT_DURATION
   - votingEnd = votingStart + VOTING_DURATION

2. Propose batchMetadataSettlement with calculated timings

3. Create soft fork:
   - Store settlement ID array in mock hashmap storage
   - Compute Merkle Tree root from settlementID array
   - Call submitSoftFork

4. Wait until voting period starts

5. Cast vote on own soft fork

6. Wait until voting period ends

7. Call finalizeBatchWinner

8. Execute next batch metadata settlement
