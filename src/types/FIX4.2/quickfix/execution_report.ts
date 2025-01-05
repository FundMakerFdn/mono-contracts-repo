import { IStandardHeader } from './set/standard_header'
import { IExecutionReportNoContraBrokers } from './set/execution_report_no_contra_brokers'
import { IStandardTrailer } from './set/standard_trailer'

export interface IExecutionReport {
  StandardHeader: IStandardHeader// [1] BeginString.8, BodyLength.9 .. OnBehalfOfSendingTime.370
  OrderID: string// [2] 37 (String)
  SecondaryOrderID?: string// [3] 198 (String)
  ClOrdID?: string// [4] 11 (String)
  OrigClOrdID?: string// [5] 41 (String)
  ClientID?: string// [6] 109 (String)
  ExecBroker?: string// [7] 76 (String)
  NoContraBrokers?: IExecutionReportNoContraBrokers[]// [8] ContraBroker.375, ContraTrader.337 .. ContraTradeTime.438
  ListID?: string// [9] 66 (String)
  ExecID: string// [10] 17 (String)
  ExecTransType: string// [11] 20 (String)
  ExecRefID?: string// [12] 19 (String)
  ExecType: string// [13] 150 (String)
  OrdStatus: string// [14] 39 (String)
  OrdRejReason?: number// [15] 103 (Int)
  ExecRestatementReason?: number// [16] 378 (Int)
  Account?: string// [17] 1 (String)
  SettlmntTyp?: string// [18] 63 (String)
  FutSettDate?: Date// [19] 64 (LocalDate)
  Symbol: string// [20] 55 (String)
  SymbolSfx?: string// [21] 65 (String)
  SecurityID?: string// [22] 48 (String)
  IDSource?: string// [23] 22 (String)
  SecurityType?: string// [24] 167 (String)
  MaturityMonthYear?: string// [25] 200 (String)
  MaturityDay?: string// [26] 205 (String)
  PutOrCall?: number// [27] 201 (Int)
  StrikePrice?: number// [28] 202 (Float)
  OptAttribute?: string// [29] 206 (String)
  ContractMultiplier?: number// [30] 231 (Float)
  CouponRate?: number// [31] 223 (Float)
  SecurityExchange?: string// [32] 207 (String)
  Issuer?: string// [33] 106 (String)
  EncodedIssuerLen?: number// [34] 348 (Length)
  EncodedIssuer?: Buffer// [35] 349 (RawData)
  SecurityDesc?: string// [36] 107 (String)
  EncodedSecurityDescLen?: number// [37] 350 (Length)
  EncodedSecurityDesc?: Buffer// [38] 351 (RawData)
  Side: string// [39] 54 (String)
  OrderQty?: number// [40] 38 (Float)
  CashOrderQty?: number// [41] 152 (Float)
  OrdType?: string// [42] 40 (String)
  Price?: number// [43] 44 (Float)
  StopPx?: number// [44] 99 (Float)
  PegDifference?: number// [45] 211 (Float)
  DiscretionInst?: string// [46] 388 (String)
  DiscretionOffset?: number// [47] 389 (Float)
  Currency?: string// [48] 15 (String)
  ComplianceID?: string// [49] 376 (String)
  SolicitedFlag?: boolean// [50] 377 (Boolean)
  TimeInForce?: string// [51] 59 (String)
  EffectiveTime?: Date// [52] 168 (UtcTimestamp)
  ExpireDate?: Date// [53] 432 (LocalDate)
  ExpireTime?: Date// [54] 126 (UtcTimestamp)
  ExecInst?: string// [55] 18 (String)
  Rule80A?: string// [56] 47 (String)
  LastShares?: number// [57] 32 (Float)
  LastPx?: number// [58] 31 (Float)
  LastSpotRate?: number// [59] 194 (Float)
  LastForwardPoints?: number// [60] 195 (Float)
  LastMkt?: string// [61] 30 (String)
  TradingSessionID?: string// [62] 336 (String)
  LastCapacity?: string// [63] 29 (String)
  LeavesQty: number// [64] 151 (Float)
  CumQty: number// [65] 14 (Float)
  AvgPx: number// [66] 6 (Float)
  DayOrderQty?: number// [67] 424 (Float)
  DayCumQty?: number// [68] 425 (Float)
  DayAvgPx?: number// [69] 426 (Float)
  GTBookingInst?: number// [70] 427 (Int)
  TradeDate?: Date// [71] 75 (LocalDate)
  TransactTime?: Date// [72] 60 (UtcTimestamp)
  ReportToExch?: boolean// [73] 113 (Boolean)
  Commission?: number// [74] 12 (Float)
  CommType?: string// [75] 13 (String)
  GrossTradeAmt?: number// [76] 381 (Float)
  SettlCurrAmt?: number// [77] 119 (Float)
  SettlCurrency?: string// [78] 120 (String)
  SettlCurrFxRate?: number// [79] 155 (Float)
  SettlCurrFxRateCalc?: string// [80] 156 (String)
  HandlInst?: string// [81] 21 (String)
  MinQty?: number// [82] 110 (Float)
  MaxFloor?: number// [83] 111 (Float)
  OpenClose?: string// [84] 77 (String)
  MaxShow?: number// [85] 210 (Float)
  Text?: string// [86] 58 (String)
  EncodedTextLen?: number// [87] 354 (Length)
  EncodedText?: Buffer// [88] 355 (RawData)
  FutSettDate2?: Date// [89] 193 (LocalDate)
  OrderQty2?: number// [90] 192 (Float)
  ClearingFirm?: string// [91] 439 (String)
  ClearingAccount?: string// [92] 440 (String)
  MultiLegReportingType?: string// [93] 442 (String)
  StandardTrailer: IStandardTrailer// [94] SignatureLength.93, Signature.89, CheckSum.10
}
