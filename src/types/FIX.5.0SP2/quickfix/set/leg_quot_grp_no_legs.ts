import { IInstrumentLeg } from './instrument_leg'
import { ILegStipulations } from './leg_stipulations'
import { INestedParties } from './nested_parties'
import { ILegBenchmarkCurveData } from './leg_benchmark_curve_data'

export interface ILegQuotGrpNoLegs {
  InstrumentLeg?: IInstrumentLeg// [1] LegSymbol.600, LegSymbolSfx.601 .. LegExchangeLookAlike.2607
  LegOrderQty?: number// [2] 685 (Float)
  LegQty?: number// [3] 687 (Float)
  LegMidPx?: number// [4] 2346 (Float)
  LegSwapType?: number// [5] 690 (Int)
  LegSettlType?: string// [6] 587 (String)
  LegSettlDate?: Date// [7] 588 (LocalDate)
  LegStipulations?: ILegStipulations// [8] NoLegStipulations.683, LegStipulationType.688, LegStipulationValue.689
  NestedParties?: INestedParties// [9] NoNestedPartyIDs.539, NestedPartyID.524 .. NestedPartySubIDType.805
  LegPriceType?: number// [10] 686 (Int)
  LegBidPx?: number// [11] 681 (Float)
  LegOfferPx?: number// [12] 684 (Float)
  LegBenchmarkCurveData?: ILegBenchmarkCurveData// [13] LegBenchmarkCurveCurrency.676, LegBenchmarkCurveCurrencyCodeSource.2951 .. LegBenchmarkPriceType.680
  LegRefID?: string// [14] 654 (String)
  LegBidForwardPoints?: number// [15] 1067 (Float)
  LegOfferForwardPoints?: number// [16] 1068 (Float)
}
