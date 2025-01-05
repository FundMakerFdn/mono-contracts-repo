import { IStandardHeader } from './set/standard_header'
import { IInstrmtStrkPxGrp } from './set/instrmt_strk_px_grp'
import { IUndInstrmtStrkPxGrp } from './set/und_instrmt_strk_px_grp'
import { IStandardTrailer } from './set/standard_trailer'

export interface IListStrikePrice {
  StandardHeader: IStandardHeader// [1] BeginString.8, BodyLength.9 .. HopRefID.630
  ListID: string// [2] 66 (String)
  TotNoStrikes: number// [3] 422 (Int)
  LastFragment?: boolean// [4] 893 (Boolean)
  InstrmtStrkPxGrp?: IInstrmtStrkPxGrp// [5] NoStrikes.428, Symbol.55 .. InterestAccrualDate.874
  UndInstrmtStrkPxGrp?: IUndInstrmtStrkPxGrp// [6] NoUnderlyings.711, UnderlyingSymbol.311 .. EncodedText.355
  StandardTrailer: IStandardTrailer// [7] SignatureLength.93, Signature.89, CheckSum.10
}
