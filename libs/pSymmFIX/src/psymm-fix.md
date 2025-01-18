# pSymm FIX protocol

- Onchain-only actions are not reflected in FIX (like transferToCustody).
- Each FIX message requires a "MessageAck" response with counterparty signature for bilateral confirmation.
- All messages include standard header fields (SendingTime, PartyA, PartyB, etc.)

For signatures & custody management we use custom pSymm-compatible messages (to easily reconstruct EIP-712 from them)
For trading, stick to standard messages

In FIX, for bytes we just use 0x... hex.

## Message signing

For trading messages: MessageAck:

- RefMsgType (941=original_message_type) // no need?
- Signature (counterparty_signature)

For native/onchain messages, use message-specific ack.

## Scenario 1.0:

1/ (FIX, onchain) A initiates custody onchain

1a/ A sends custody FIX message

CustodyCreation (35=custom_type_custody)

- CustodyID (int)
- SettlementAddress (ethereum_address)
- MA (bytes32)
- IsManaged (Y/N bool)
- CustodyType (uint8)
- Expiration (UTC_timestamp)
- Timestamp (UTC_timestamp)
- PartyID (int)
- Signature (bytes)

1b/ A receives an ack specific to custody creation

CustodyCreationAck (35=custom_type_custody_ack)

- RefCustodyID (matching_custody_id)
- Signature (bytes)

1c/ A creates custody onchain

2/ (onchain) A deposits to custody
3/ (onchain) B deposits to custody

4/ (FIX) A sends QuoteRequest to B:

QuoteRequest (35=R)

- QuoteReqID (131=unique_id)
- Symbol (55=contract_symbol)
- Side (54=1 or 2)
- OrderQty (38=quantity)

5/ (FIX) B sends Quote to A:

Quote (35=S)

- QuoteID (117=unique_id)
- QuoteReqID (131=matching_request_id)
- Symbol (55=contract_symbol)
- BidPx (132=bid_price)
- OfferPx (133=ask_price)
- BidSize (134=bid_size)
- OfferSize (135=ask_size)

6/ (FIX) A sends NewOrderSingle to B:

NewOrderSingle (35=D)

- ClOrdID (11=unique_order_id)
- Symbol (55=contract_symbol)
- Side (54=1 or 2)
- OrderQty (38=100)
- OrdType (40=2) // Limit order
- Price (44=agreed_price)
- TimeInForce (59=appropriate_value)

7/ (FIX) B sends ExecutionReport to A for first 50 contracts:

ExecutionReport (35=8)

- OrderID (37=unique_execution_id)
- ClOrdID (11=matching_order_id)
- ExecType (150=2) // Fill
- OrdStatus (39=1) // Partially filled
- Symbol (55=contract_symbol)
- Side (54=1 or 2)
- LeavesQty (151=50)
- CumQty (14=50)
- LastQty (32=50)
- LastPx (31=execution_price)

8/ (FIX) B sends ExecutionReport to A for final 50 contracts:

ExecutionReport (35=8)

- OrderID (37=unique_execution_id)
- ClOrdID (11=matching_order_id)
- ExecType (150=2) // Fill
- OrdStatus (39=2) // Filled
- Symbol (55=contract_symbol)
- Side (54=1 or 2)
- LeavesQty (151=0)
- CumQty (14=100)
- LastQty (32=50)
- LastPx (31=execution_price)

9/ (FIX, onchain) B,A withdraw
9a/ (onchain) B creates transferFromCustody with withdraw distribution between parties.
9b/ (FIX) B communicates it to A

TransferFromCustody (35=custom_type_transfer)

- CustodyID (int)
- CollateralAmount (int)
- CollateralToken (ethereum_address)
- Expiration (UTC_timestamp)
- Timestamp (UTC_timestamp)
- PartyID (int)
- SignatureA (bytes)

9c/ A sends ack

TransferFromCustodyAck (35=custom_type_transfer_ack)

- RefCustodyID (matching_custody_id)
- SignatureB (bytes)

9d/ (onchain) B executes custody withdraw
