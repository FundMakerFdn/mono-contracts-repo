import { IStandardHeader } from './set/standard_header'
import { IStandardTrailer } from './set/standard_trailer'

export interface IPayManagementReportAck {
  StandardHeader: IStandardHeader// [1] BeginString.8, BodyLength.9 .. HopRefID.630
  PayReportID: string// [2] 2799 (String)
  PayReportStatus: number// [3] 2806 (Int)
  PayDisputeReason?: number// [4] 2800 (Int)
  RejectText?: string// [5] 1328 (String)
  EncodedRejectTextLen?: number// [6] 1664 (Length)
  EncodedRejectText?: Buffer// [7] 1665 (RawData)
  StandardTrailer: IStandardTrailer// [8] SignatureLength.93, Signature.89, CheckSum.10
}
