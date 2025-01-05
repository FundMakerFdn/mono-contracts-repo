Only submit bad or usefull tx and deposits to the settlement. Allowing to keep privacy on the rest.

custody.MA.LPRole is the role that for each withdraw needs to sign a tx. For example GP is partyA and Solver is partyB, LPRole is LP of the GP. Or in the case where user is a non professional, he ask a GP to apply his trades, ever trhough EIP712 approval, either trough MA rules. To not on EIP712 approval of each trades, GP still sign the checkpointTx or other non primary tx. In case there is a instantWithdraw role, both party are liable to respect rules in the MA.
If LPRole is not set or address(0), only partyA and partyB signatures are needed. Additionally, LP can be a triparty or trusted regulated entity.
custody.isManaged is true, a proof of address of LPRole in the MA is needed.