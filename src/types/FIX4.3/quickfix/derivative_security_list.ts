import { IStandardHeader } from './set/standard_header'
import { IUnderlyingInstrument } from './set/underlying_instrument'
import { IDerivativeSecurityListNoRelatedSym } from './set/derivative_security_list_no_related_sym'
import { IStandardTrailer } from './set/standard_trailer'

export interface IDerivativeSecurityList {
  StandardHeader: IStandardHeader// [1] BeginString.8, BodyLength.9 .. HopRefID.630
  SecurityReqID: string// [2] 320 (String)
  SecurityResponseID: string// [3] 322 (String)
  SecurityRequestResult: number// [4] 560 (Int)
  UnderlyingInstrument?: IUnderlyingInstrument// [5] UnderlyingSymbol.311, UnderlyingSymbolSfx.312 .. EncodedUnderlyingSecurityDesc.365
  TotalNumSecurities?: number// [6] 393 (Int)
  NoRelatedSym?: IDerivativeSecurityListNoRelatedSym[]// [7] Symbol.55, SymbolSfx.65 .. EncodedText.355
  StandardTrailer: IStandardTrailer// [8] SignatureLength.93, Signature.89, CheckSum.10
}
