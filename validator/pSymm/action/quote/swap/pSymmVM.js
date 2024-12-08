import { PriceGenerator } from "./lib/getPrice.js";

const priceAPI = new PriceGenerator();

const pSymmVM = {
  state: null,

  init: (pSymmVM, leaf, root, params, reconciliation) => {
    this.state = {
      leaf: leaf,
      pSymmVM: pSymmVM,
      root: root,
      params: params,
      reconciliation: reconciliation,
    };
  },

  _verifyQuote: () => {
    // find quote associated to leaf.params.quoteNonce
    const quote = this.state.root.find(
      (leaf) => leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
    );
    if (!quote) {
      this.state.reconciliation.push({
        type: "swap",
        side:
          this.state.leaf.emitterAddress == this.state.pSymmVM.state.partyA
            ? "A"
            : "B",
      });
    }
  },

  verifyFillAmmount: () => {
    // get all quoteFill/swap/open, quote/swap/open, quote/swap/cancel leaves where leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
    const quoteFillOpenLeaves = this.state.root.filter(
      (leaf) =>
        leaf.type == "quoteFill/swap/open" &&
        leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
    );
    const quoteOpenLeaves = this.state.root.filter(
      (leaf) =>
        leaf.type == "quote/swap/open" &&
        leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
    );
    const quoteCancelLeaves = this.state.root.filter(
      (leaf) =>
        leaf.type == "quote/swap/cancel" &&
        leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
    );
    const quoteFillCancelLeaves = this.state.root.filter(
      (leaf) =>
        leaf.type == "quoteFill/swap/cancel" &&
        leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
    );
    const cancelGracePeriod = this.state.leaf.cancelGracePeriod;
    if (
      quoteFillOpenLeaves.length > 0 ||
      quoteOpenLeaves.length > 0 ||
      quoteCancelLeaves.length > 0 ||
      quoteFillCancelLeaves.length > 0
    ) {
      if (this.state.quote.params.amount > this.state.leaf.params.amount) {
        this.state.reconciliation.push({
          type: "swap",
          side:
            this.state.leaf.emitterAddress == this.state.pSymmVM.state.partyA
              ? "A"
              : "B",
          amount:
            this.state.quote.params.amount - this.state.leaf.params.amount,
        });
      }
    }
  },

  open: () => {
    this._verifyQuote();
    const isA =
      this.state.leaf.emitterAddress == this.state.pSymmVM.state.partyA
        ? true
        : false;
    const generator = new PriceGenerator();
    const { open, high, low, close } = generator.getPrice(
      this.state.leaf.params.ISIN,
      new Date(this.state.leaf.timestamp)
    );
    // verify collateral is enough
    if (
      this.state.pSymmVM.state.IM_A <
      this.state.leaf.params.IM_A * close * this.state.leaf.params.amount
    ) {
      this.state.reconciliation.push({
        type: "swap",
        side: "A",
        amount:
          this.state.leaf.params.IM_A * close * this.state.leaf.params.amount -
          this.state.pSymmVM.state.IM_A,
      });
    }
    if (
      this.state.pSymmVM.state.IM_B <
      this.state.leaf.params.IM_B * close * this.state.leaf.params.amount
    ) {
      this.state.reconciliation.push({
        type: "swap",
        side: "B",
        amount:
          this.state.leaf.params.IM_B * close * this.state.leaf.params.amount -
          this.state.pSymmVM.state.IM_B,
      });
    }
    // find in SymmVM.state.params if same type and ISIN already exists
    const existingIndex = this.state.pSymmVM.state.params.findIndex(
      (param) =>
        param.ISIN === this.state.leaf.params.ISIN &&
        param.type === this.state.leaf.params.type
    );

    if (existingIndex !== -1) {
      // if exists, update amount and avgEntryPrice
      const existingParam = SymmVM.state.params[existingIndex];
      const totalAmount = existingParam.amount + leaf.params.amount;
      existingParam.avgEntryPrice =
        (existingParam.avgEntryPrice * existingParam.amount +
          close * leaf.params.amount) /
        totalAmount;
      existingParam.amount = totalAmount;
    } else {
      // if not exists, add to SymmVM.state.params
      SymmVM.state.params.push({
        ISIN: leaf.params.ISIN,
        type: leaf.params.type,
        avgEntryPrice: close,
        amount: leaf.params.amount,
      });
    }
  },

  verifyPrice: () => {
    console.log("Verifying price");

    // case where counterparty is saying that he did push fill quote, but is counteparty don't agree
    // If counterparty doesn't sign reception, push onchain till dispute
  },

  getState: () => {
    return this.state;
  },
};

export default pSymmVM;

/*
  1/ You'll integrate this subgraph, the same way binance and thena are integrated and add it to different flags.
  https://thegraph.com/explorer/subgraphs/7StqFFqbxi3jcN5C9YxhRiTxQM8HA8XEHopsynqqxw3t?view=Query&chain=arbitrum-one
  https://github.com/FundMakerFdn/fundmaker-strategy-sdk/tree/main/src/UniswapV3_ETH

  Pool valuation have some issues, you will implement a TWAP.

  2/ Pool valuation plotter``
  3/ Using pool valuation plotter you will make a yarn correct_pool_valuation_datas , that will rectify outliers.
  */

