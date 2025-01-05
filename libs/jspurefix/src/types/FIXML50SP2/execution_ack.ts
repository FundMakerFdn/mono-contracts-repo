import { IStandardHeader } from './set/standard_header'
import { IInstrument } from './set/instrument'
import { IUndInstrmtGrp } from './set/und_instrmt_grp'
import { IInstrmtLegGrp } from './set/instrmt_leg_grp'
import { IOrderQtyData } from './set/order_qty_data'
import { IRegulatoryTradeIDGrp } from './set/regulatory_trade_id_grp'

/*
************************************************
* ExecutionAck can be found in Volume 4 of the *
*                                              *
* specification                                *
************************************************
*/
export interface IExecutionAck {
  OrderID: string// [2] 37 (String)
  SecondaryOrderID?: string// [2] 198 (String)
  ClOrdID?: string// [2] 11 (String)
  ExecAckStatus: string// [2] 1036 (String)
  ExecID: string// [2] 17 (String)
  DKReason?: string// [2] 127 (String)
  Side: string// [2] 54 (String)
  LastQty?: number// [2] 32 (Float)
  LastPx?: number// [2] 31 (Float)
  PriceType?: number// [2] 423 (Int)
  LastParPx?: number// [2] 669 (Float)
  CumQty?: number// [2] 14 (Float)
  AvgPx?: number// [2] 6 (Float)
  Text?: string// [2] 58 (String)
  EncodedTextLen?: number// [2] 354 (Length)
  EncodedText?: Buffer// [2] 355 (RawData)
  StandardHeader?: IStandardHeader// [1] MsgTyp.35, ApplVerID.1128 .. MsgEncd.347
  Instrument?: IInstrument// [2] Sym.55, Sfx.65 .. ExchLookAlike.2603
  UndInstrmtGrp?: IUndInstrmtGrp[]// [3] Sym.311, Sfx.312 .. XID.2631
  InstrmtLegGrp?: IInstrmtLegGrp[]// [4] Sym.600, Sfx.601 .. ExchLookAlike.2607
  OrderQtyData?: IOrderQtyData// [5] Qty.38, Cash.152 .. RndMod.469
  RegulatoryTradeIDGrp?: IRegulatoryTradeIDGrp[]// [6] ID.1903, Src.1905 .. Scope.2397
}
