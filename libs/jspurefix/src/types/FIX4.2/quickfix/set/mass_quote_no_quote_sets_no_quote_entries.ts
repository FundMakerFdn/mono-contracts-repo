export interface IMassQuoteNoQuoteSetsNoQuoteEntries {
  QuoteEntryID: string// [1] 299 (String)
  Symbol?: string// [2] 55 (String)
  SymbolSfx?: string// [3] 65 (String)
  SecurityID?: string// [4] 48 (String)
  IDSource?: string// [5] 22 (String)
  SecurityType?: string// [6] 167 (String)
  MaturityMonthYear?: string// [7] 200 (String)
  MaturityDay?: string// [8] 205 (String)
  PutOrCall?: number// [9] 201 (Int)
  StrikePrice?: number// [10] 202 (Float)
  OptAttribute?: string// [11] 206 (String)
  ContractMultiplier?: number// [12] 231 (Float)
  CouponRate?: number// [13] 223 (Float)
  SecurityExchange?: string// [14] 207 (String)
  Issuer?: string// [15] 106 (String)
  EncodedIssuerLen?: number// [16] 348 (Length)
  EncodedIssuer?: Buffer// [17] 349 (RawData)
  SecurityDesc?: string// [18] 107 (String)
  EncodedSecurityDescLen?: number// [19] 350 (Length)
  EncodedSecurityDesc?: Buffer// [20] 351 (RawData)
  BidPx?: number// [21] 132 (Float)
  OfferPx?: number// [22] 133 (Float)
  BidSize?: number// [23] 134 (Float)
  OfferSize?: number// [24] 135 (Float)
  ValidUntilTime?: Date// [25] 62 (UtcTimestamp)
  BidSpotRate?: number// [26] 188 (Float)
  OfferSpotRate?: number// [27] 190 (Float)
  BidForwardPoints?: number// [28] 189 (Float)
  OfferForwardPoints?: number// [29] 191 (Float)
  TransactTime?: Date// [30] 60 (UtcTimestamp)
  TradingSessionID?: string// [31] 336 (String)
  FutSettDate?: Date// [32] 64 (LocalDate)
  OrdType?: string// [33] 40 (String)
  FutSettDate2?: Date// [34] 193 (LocalDate)
  OrderQty2?: number// [35] 192 (Float)
  Currency?: string// [36] 15 (String)
}
