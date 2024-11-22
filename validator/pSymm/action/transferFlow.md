1// PartyA, PartyB, ReceiverPartyA, ReceiverPartyB sign contract transfer, deposit & withdraw signatures for collateral transfer. 


### Instant microCustodyRollup deposit
    - Deposit in a trusted main solver, solver agrees on instant transfer tx packed with subaccount/init and quote/swap/open tx.
    - Ex instant microRollup provider can be pSymmio
        - Stuff can be added like all trusted solvers need to sign a tx for instant transfer, money is holded in symmio microCustodyRollup.

### Triparty Instant CustodyRollup to CustodyRollup transfer
    - PartyA, PartyB sends a signed tx of the current state of their custodyRollup to PartyC
    - PartyA, PartyB and PartyC agrees on a sign of an instant transfer tx
    - PartyC submits the tx to the chain