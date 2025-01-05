import { IStandardHeader } from './set/standard_header'
import { IParties } from './set/parties'
import { IQuotSetAckGrp } from './set/quot_set_ack_grp'
import { IStandardTrailer } from './set/standard_trailer'

/*
***************************************************************
* Mass Quote Acknowledgement is used as the application level *
* response to a Mass Quote message.                           *
***************************************************************
*/
export interface IMassQuoteAcknowledgement {
  StandardHeader: IStandardHeader// [1] BeginString.8, BodyLength.9 .. HopRefID.630
  QuoteReqID?: string// [2] 131 (String)
  QuoteID?: string// [3] 117 (String)
  QuoteStatus: number// [4] 297 (Int)
  QuoteRejectReason?: number// [5] 300 (Int)
  QuoteResponseLevel?: number// [6] 301 (Int)
  QuoteType?: number// [7] 537 (Int)
  Parties?: IParties[]// [8] PartyID.448, PartyIDSource.447 .. PartySubIDType.803
  Account?: string// [9] 1 (String)
  AcctIDSource?: number// [10] 660 (Int)
  AccountType?: number// [11] 581 (Int)
  Text?: string// [12] 58 (String)
  EncodedTextLen?: number// [13] 354 (Int)
  EncodedText?: Buffer// [14] 355 (RawData)
  QuotSetAckGrp?: IQuotSetAckGrp[]// [15] QuoteSetID.302, UnderlyingSymbol.311 .. QuoteEntryRejectReason.368
  StandardTrailer: IStandardTrailer// [16] SignatureLength.93, Signature.89, CheckSum.10
}
