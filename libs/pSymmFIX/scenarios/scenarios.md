/* ---- Custom MsgTypes: ---- */
// CUST: CreateCustody
// CACK: CreateCustodyAck
// ACK:  MessageAck (Generic)
// TFRC: TransferFromCustody
// TACK: TransferFromCustodyAck

1.1.X scenarios are for the newOrderSingle, ExecutionReport, Cancel
1.2.X scenarios are for the liquidation
1.3.X scenarios are for the PPM

/* ------------ Scenario 1.0.0 : ------------ */   
// 1a. A: pSymm.createCustody()
// 2a. A: pSymm.addressToCustody()
// 3a. A: QuoteRequest
// 3b. B: MessageAck for QuoteRequest
// 4a. B: Quote
// 4b. A: MessageAck for Quote
// 5a. A: NewOrderSingle
// 5b. B: MessageAck for NewOrderSingle
// 6a. B: pSymm.custodyToAddress()
// 7a. B: first ExecutionReport
// 7b. A: MessageAck for first ExecutionReport
// 8a. B: second ExecutionReport
// 8b. A: MessageAck for second ExecutionReport
// 9a. B: TransferFromCustody
// 9b. A: TransferFromCustodyAck for B's withdrawal
// 10a. A: TransferFromCustody
// 10b. B: TransferFromCustodyAck for A's withdrawal

note : deposit, rfq, quote, newOrderSingle, executionReport, transferFromCustody, without issues

/* ------------ Scenario 1.1.1: ------------ */
// 1a. A: pSymm.createCustody()
// 2a. A: pSymm.addressToCustody()
// 3a. A: QuoteRequest
// 3b. B: MessageAck for QuoteRequest
// 4a. B: Quote
// 4b. A: MessageAck for Quote
// 5a. A: NewOrderSingle
// 5b. B: MessageAck for NewOrderSingle
// 6a. B: pSymm.custodyToAddress()
// 6b. A: Reject not enough collateral

note : deposit, rfq, quote, newOrderSingle, executionReport, transferFromCustody rejected becayse not enough collateral

/* ------------ Scenario 1.1.2: ------------ */

note : ..., quote, no quote ack because parameter is not valid

/* ------------ Scenario 1.1.3: ------------ */

note : ..., newOrderSingle, cancel, cancel ack

/* ------------ Scenario 1.1.4: ------------ */

note : ..., newOrderSingle, cancel, executionReport, executionReport Ack ( executionReport cancel the cancel if in less than x second)

/* ------------ Scenario 1.1.5: ------------ */

note : ..., newOrderSingle, newOrderSingle Ack, executionReport, cancel, cancel reject ( late cancel due to network latency)

/* ------------ Scenario 1.1.6: ------------ */

note : ..., newOrderSingle, (partial) executionReport, executionReport Ack, remaining cancel, cancel ack

/* ------------ Scenario 1.1.7: ------------ */

note : ..., newOrderSingle, (partial) executionReport, cancel, executionReport Ack, cancel ack only ammount remaining ( cancel casted before receiving partial executionReport)

/* ------------ Scenario 1.2.0: ------------ */

note : ..., executionReport, liquidation, liquidation Ack

/* ------------ Scenario 1.2.1: ------------ */

note : ..., executionReport, liquidation, liquidation Ack

/* ------------ Scenario 1.2.2: ------------ */


/* ------------ Scenario 1.3.0: ------------ */

note : PPM cancel grace period, heathbeat, heathbeat % ACK, minContractAmount, contractExpiry, max%LimitOrderFromPrice, min%LimitOrderFromPrice,  fundingRateSource