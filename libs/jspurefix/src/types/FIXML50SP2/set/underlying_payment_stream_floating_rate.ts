import { IUnderlyingPaymentStreamPricingBusinessCenterGrp } from './underlying_payment_stream_pricing_business_center_grp'
import { IUnderlyingPaymentStreamPricingDayGrp } from './underlying_payment_stream_pricing_day_grp'
import { IUnderlyingPaymentStreamPricingDateGrp } from './underlying_payment_stream_pricing_date_grp'
import { IUnderlyingPaymentStreamFormula } from './underlying_payment_stream_formula'
import { IUnderlyingDividendConditions } from './underlying_dividend_conditions'
import { IUnderlyingReturnRateGrp } from './underlying_return_rate_grp'

export interface IUnderlyingPaymentStreamFloatingRate {
  UnderlyingPaymentStreamRateIndex?: string// [1] 40620 (String)
  UnderlyingPaymentStreamRateIndexSource?: number// [1] 40621 (Int)
  UnderlyingPaymentStreamRateIndexCurveUnit?: string// [1] 40622 (String)
  UnderlyingPaymentStreamRateIndexCurvePeriod?: number// [1] 40623 (Int)
  UnderlyingPaymentStreamRateIndex2CurveUnit?: string// [1] 41911 (String)
  UnderlyingPaymentStreamRateIndex2CurvePeriod?: number// [1] 41912 (Int)
  UnderlyingPaymentStreamRateIndexLocation?: string// [1] 41913 (String)
  UnderlyingPaymentStreamRateIndexLevel?: number// [1] 41914 (Float)
  UnderlyingPaymentStreamRateIndexUnitOfMeasure?: string// [1] 41915 (String)
  UnderlyingPaymentStreamSettlLevel?: number// [1] 41916 (Int)
  UnderlyingPaymentStreamReferenceLevel?: number// [1] 41917 (Float)
  UnderlyingPaymentStreamReferenceLevelUnitOfMeasure?: string// [1] 41918 (String)
  UnderlyingPaymentStreamReferenceLevelEqualsZeroIndicator?: boolean// [1] 41919 (Boolean)
  UnderlyingPaymentStreamRateMultiplier?: number// [1] 40624 (Float)
  UnderlyingPaymentStreamRateSpread?: number// [1] 40625 (Float)
  UnderlyingPaymentStreamRateSpreadCurrency?: string// [1] 41920 (String)
  UnderlyingPaymentStreamRateSpreadUnitOfMeasure?: string// [1] 41921 (String)
  UnderlyingPaymentStreamRateConversionFactor?: number// [1] 41922 (Float)
  UnderlyingPaymentStreamRateSpreadType?: number// [1] 41923 (Int)
  UnderlyingPaymentStreamRateSpreadPositionType?: number// [1] 40626 (Int)
  UnderlyingPaymentStreamRateTreatment?: number// [1] 40627 (Int)
  UnderlyingPaymentStreamCapRate?: number// [1] 40628 (Float)
  UnderlyingPaymentStreamCapRateBuySide?: number// [1] 40629 (Int)
  UnderlyingPaymentStreamCapRateSellSide?: number// [1] 40630 (Int)
  UnderlyingPaymentStreamFloorRate?: number// [1] 40631 (Float)
  UnderlyingPaymentStreamFloorRateBuySide?: number// [1] 40632 (Int)
  UnderlyingPaymentStreamFloorRateSellSide?: number// [1] 40633 (Int)
  UnderlyingPaymentStreamInitialRate?: number// [1] 40634 (Float)
  UnderlyingPaymentStreamLastResetRate?: number// [1] 41924 (Float)
  UnderlyingPaymentStreamFinalRate?: number// [1] 41925 (Float)
  UnderlyingPaymentStreamFinalRateRoundingDirection?: string// [1] 40635 (String)
  UnderlyingPaymentStreamFinalRatePrecision?: number// [1] 40636 (Int)
  UnderlyingPaymentStreamAveragingMethod?: number// [1] 40637 (Int)
  UnderlyingPaymentStreamNegativeRateTreatment?: number// [1] 40638 (Int)
  UnderlyingPaymentStreamCalculationLagPeriod?: number// [1] 41926 (Int)
  UnderlyingPaymentStreamCalculationLagUnit?: string// [1] 41927 (String)
  UnderlyingPaymentStreamFirstObservationDateUnadjusted?: Date// [1] 42958 (LocalDate)
  UnderlyingPaymentStreamFirstObservationDateRelativeTo?: number// [1] 42959 (Int)
  UnderlyingPaymentStreamFirstObservationDateOffsetDayType?: number// [1] 42960 (Int)
  UnderlyingPaymentStreamFirstObservationDateOffsetPeriod?: number// [1] 41928 (Int)
  UnderlyingPaymentStreamFirstObservationDateOffsetUnit?: string// [1] 41929 (String)
  UnderlyingPaymentStreamFirstObservationDateAdjusted?: Date// [1] 42961 (LocalDate)
  UnderlyingPaymentStreamPricingDayType?: number// [1] 41930 (Int)
  UnderlyingPaymentStreamPricingDayDistribution?: number// [1] 41931 (Int)
  UnderlyingPaymentStreamPricingDayCount?: number// [1] 41932 (Int)
  UnderlyingPaymentStreamPricingBusinessCalendar?: string// [1] 41933 (String)
  UnderlyingPaymentStreamPricingBusinessDayConvention?: number// [1] 41934 (Int)
  UnderlyingPaymentStreamInflationLagPeriod?: number// [1] 40639 (Int)
  UnderlyingPaymentStreamInflationLagUnit?: string// [1] 40640 (String)
  UnderlyingPaymentStreamInflationLagDayType?: number// [1] 40641 (Int)
  UnderlyingPaymentStreamInflationInterpolationMethod?: number// [1] 40642 (Int)
  UnderlyingPaymentStreamInflationIndexSource?: number// [1] 40643 (Int)
  UnderlyingPaymentStreamInflationPublicationSource?: string// [1] 40644 (String)
  UnderlyingPaymentStreamInflationInitialIndexLevel?: number// [1] 40645 (Float)
  UnderlyingPaymentStreamInflationFallbackBondApplicable?: boolean// [1] 40646 (Boolean)
  UnderlyingPaymentStreamFRADiscounting?: number// [1] 40647 (Int)
  UnderlyingPaymentStreamUnderlierRefID?: string// [1] 42962 (String)
  UnderlyingReturnRateNotionalReset?: boolean// [1] 42963 (Boolean)
  UnderlyingPaymentStreamLinkInitialLevel?: number// [1] 42964 (Float)
  UnderlyingPaymentStreamLinkClosingLevelIndicator?: boolean// [1] 42965 (Boolean)
  UnderlyingPaymentStreamLinkExpiringLevelIndicator?: boolean// [1] 42966 (Boolean)
  UnderlyingPaymentStreamLinkEstimatedTradingDays?: number// [1] 42967 (Int)
  UnderlyingPaymentStreamLinkStrikePrice?: number// [1] 42968 (Float)
  UnderlyingPaymentStreamLinkStrikePriceType?: number// [1] 42969 (Int)
  UnderlyingPaymentStreamLinkMaximumBoundary?: number// [1] 42970 (Float)
  UnderlyingPaymentStreamLinkMinimumBoundary?: number// [1] 42971 (Float)
  UnderlyingPaymentStreamLinkNumberOfDataSeries?: number// [1] 42972 (Int)
  UnderlyingPaymentStreamVarianceUnadjustedCap?: number// [1] 42973 (Float)
  UnderlyingPaymentStreamRealizedVarianceMethod?: number// [1] 42974 (Int)
  UnderlyingPaymentStreamDaysAdjustmentIndicator?: boolean// [1] 42975 (Boolean)
  UnderlyingPaymentStreamNearestExchangeContractRefID?: string// [1] 42976 (String)
  UnderlyingPaymentStreamVegaNotionalAmount?: number// [1] 42977 (Float)
  UnderlyingPaymentStreamPricingBusinessCenterGrp?: IUnderlyingPaymentStreamPricingBusinessCenterGrp[]// [1] Ctr.41910
  UnderlyingPaymentStreamPricingDayGrp?: IUnderlyingPaymentStreamPricingDayGrp[]// [2] DayOfWk.41945, DayNum.41946
  UnderlyingPaymentStreamPricingDateGrp?: IUnderlyingPaymentStreamPricingDateGrp[]// [3] Dt.41942, Typ.41943
  UnderlyingPaymentStreamFormula?: IUnderlyingPaymentStreamFormula// [4] Ccy.42978, CcyDtrmnMeth.42979, RefAmt.42980
  UnderlyingDividendConditions?: IUnderlyingDividendConditions// [5] RnvstmntInd.42826, EntlmntEvnt.42827 .. AllDividendInd.42845
  UnderlyingReturnRateGrp?: IUnderlyingReturnRateGrp[]// [6] PxSeq.43035, CommBasis.43036 .. FnlPxFallbck.43059
}
