import { INewOrderListNoOrdersNoAllocs } from './new_order_list_no_orders_no_allocs'
import { INewOrderListNoOrdersNoTradingSessions } from './new_order_list_no_orders_no_trading_sessions'

export interface INewOrderListNoOrders {
  ClOrdID: string// [1] 11 (String)
  ListSeqNo: number// [2] 67 (Int)
  SettlInstMode?: string// [3] 160 (String)
  ClientID?: string// [4] 109 (String)
  ExecBroker?: string// [5] 76 (String)
  Account?: string// [6] 1 (String)
  NoAllocs?: INewOrderListNoOrdersNoAllocs[]// [7] AllocAccount.79, AllocShares.80
  SettlmntTyp?: string// [8] 63 (String)
  FutSettDate?: Date// [9] 64 (LocalDate)
  HandlInst?: string// [10] 21 (String)
  ExecInst?: string// [11] 18 (String)
  MinQty?: number// [12] 110 (Float)
  MaxFloor?: number// [13] 111 (Float)
  ExDestination?: string// [14] 100 (String)
  NoTradingSessions?: INewOrderListNoOrdersNoTradingSessions[]// [15] TradingSessionID.336
  ProcessCode?: string// [16] 81 (String)
  Symbol: string// [17] 55 (String)
  SymbolSfx?: string// [18] 65 (String)
  SecurityID?: string// [19] 48 (String)
  IDSource?: string// [20] 22 (String)
  SecurityType?: string// [21] 167 (String)
  MaturityMonthYear?: string// [22] 200 (String)
  MaturityDay?: string// [23] 205 (String)
  PutOrCall?: number// [24] 201 (Int)
  StrikePrice?: number// [25] 202 (Float)
  OptAttribute?: string// [26] 206 (String)
  ContractMultiplier?: number// [27] 231 (Float)
  CouponRate?: number// [28] 223 (Float)
  SecurityExchange?: string// [29] 207 (String)
  Issuer?: string// [30] 106 (String)
  EncodedIssuerLen?: number// [31] 348 (Length)
  EncodedIssuer?: Buffer// [32] 349 (RawData)
  SecurityDesc?: string// [33] 107 (String)
  EncodedSecurityDescLen?: number// [34] 350 (Length)
  EncodedSecurityDesc?: Buffer// [35] 351 (RawData)
  PrevClosePx?: number// [36] 140 (Float)
  Side: string// [37] 54 (String)
  SideValueInd?: number// [38] 401 (Int)
  LocateReqd?: boolean// [39] 114 (Boolean)
  TransactTime?: Date// [40] 60 (UtcTimestamp)
  OrderQty?: number// [41] 38 (Float)
  CashOrderQty?: number// [42] 152 (Float)
  OrdType?: string// [43] 40 (String)
  Price?: number// [44] 44 (Float)
  StopPx?: number// [45] 99 (Float)
  Currency?: string// [46] 15 (String)
  ComplianceID?: string// [47] 376 (String)
  SolicitedFlag?: boolean// [48] 377 (Boolean)
  IOIid?: string// [49] 23 (String)
  QuoteID?: string// [50] 117 (String)
  TimeInForce?: string// [51] 59 (String)
  EffectiveTime?: Date// [52] 168 (UtcTimestamp)
  ExpireDate?: Date// [53] 432 (LocalDate)
  ExpireTime?: Date// [54] 126 (UtcTimestamp)
  GTBookingInst?: number// [55] 427 (Int)
  Commission?: number// [56] 12 (Float)
  CommType?: string// [57] 13 (String)
  Rule80A?: string// [58] 47 (String)
  ForexReq?: boolean// [59] 121 (Boolean)
  SettlCurrency?: string// [60] 120 (String)
  Text?: string// [61] 58 (String)
  EncodedTextLen?: number// [62] 354 (Length)
  EncodedText?: Buffer// [63] 355 (RawData)
  FutSettDate2?: Date// [64] 193 (LocalDate)
  OrderQty2?: number// [65] 192 (Float)
  OpenClose?: string// [66] 77 (String)
  CoveredOrUncovered?: number// [67] 203 (Int)
  CustomerOrFirm?: number// [68] 204 (Int)
  MaxShow?: number// [69] 210 (Float)
  PegDifference?: number// [70] 211 (Float)
  DiscretionInst?: string// [71] 388 (String)
  DiscretionOffset?: number// [72] 389 (Float)
  ClearingFirm?: string// [73] 439 (String)
  ClearingAccount?: string// [74] 440 (String)
}
