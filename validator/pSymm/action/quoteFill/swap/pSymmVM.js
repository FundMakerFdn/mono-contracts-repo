const { PriceGenerator } = require('./lib/getPrice.js');

const priceAPI = new PriceGenerator();

const pSymmVM = {
    state: null,

    init: (pSymmVM, leaf, root, params, reconciliation) => {
        this.state = {
            leaf: leaf,
            pSymmVM: pSymmVM,
            root: root,
            params: params,
            reconciliation: reconciliation
        };
    },

    _verifyQuote: () => {
        // find quote associated to leaf.params.quoteNonce
        const quote = this.state.root.find(leaf => leaf.params.quoteNonce == this.state.leaf.params.quoteNonce);
        if (!quote) {
            this.state.reconciliation.push({
                type: 'swap',
                side: this.state.leaf.emitterAddress == this.state.pSymmVM.state.partyA ? 'A' : 'B'
            });
        }
    },

    verifyFillAmmount: () => {
        // get all quoteFill/swap/open, quote/swap/open, quote/swap/cancel leaves where leaf.params.quoteNonce == this.state.leaf.params.quoteNonce
        const quoteFillOpenLeaves = this.state.root.filter(leaf => leaf.type == 'quoteFill/swap/open' && leaf.params.quoteNonce == this.state.leaf.params.quoteNonce);
        const quoteOpenLeaves = this.state.root.filter(leaf => leaf.type == 'quote/swap/open' && leaf.params.quoteNonce == this.state.leaf.params.quoteNonce);
        const quoteCancelLeaves = this.state.root.filter(leaf => leaf.type == 'quote/swap/cancel' && leaf.params.quoteNonce == this.state.leaf.params.quoteNonce);
        const quoteFillCancelLeaves = this.state.root.filter(leaf => leaf.type == 'quoteFill/swap/cancel' && leaf.params.quoteNonce == this.state.leaf.params.quoteNonce);
        const cancelGracePeriod = this.state.leaf.cancelGracePeriod;
        if (quoteFillOpenLeaves.length > 0 || quoteOpenLeaves.length > 0 || quoteCancelLeaves.length > 0 || quoteFillCancelLeaves.length > 0) {
            if (this.state.quote.params.amount > this.state.leaf.params.amount) {
                this.state.reconciliation.push({
                    type: 'swap',
                    side: this.state.leaf.emitterAddress == this.state.pSymmVM.state.partyA ? 'A' : 'B',
                    amount: this.state.quote.params.amount - this.state.leaf.params.amount
                });
            }
        }
    },

    open: () => {
        this._verifyQuote();
        const isA = this.state.leaf.emitterAddress == this.state.pSymmVM.state.partyA ? true : false;
        const generator = new PriceGenerator();
        const { open, high, low, close } = generator.getPrice(this.state.leaf.params.ISIN, new Date(this.state.leaf.timestamp));
        // verify collateral is enough
        if (this.state.pSymmVM.state.IM_A < this.state.leaf.params.IM_A * close * this.state.leaf.params.amount) {
            this.state.reconciliation.push({
                type: 'swap',
                side: 'A',
                amount: this.state.leaf.params.IM_A * close * this.state.leaf.params.amount - this.state.pSymmVM.state.IM_A
            });
        } 
        if (this.state.pSymmVM.state.IM_B < this.state.leaf.params.IM_B * close * this.state.leaf.params.amount) {
            this.state.reconciliation.push({
                type: 'swap',
                side: 'B',
                amount: this.state.leaf.params.IM_B * close * this.state.leaf.params.amount - this.state.pSymmVM.state.IM_B
            });
        } 
        // find in SymmVM.state.params if same type and ISIN already exists
        const existingIndex = this.state.pSymmVM.state.params.findIndex(param => 
            param.ISIN === this.state.leaf.params.ISIN && param.type === this.state.leaf.params.type
        );

        if (existingIndex !== -1) {
            // if exists, update amount and avgEntryPrice
            const existingParam = SymmVM.state.params[existingIndex];
            const totalAmount = existingParam.amount + leaf.params.amount;
            existingParam.avgEntryPrice = ((existingParam.avgEntryPrice * existingParam.amount) + (close * leaf.params.amount)) / totalAmount;
            existingParam.amount = totalAmount;
        } else {
            // if not exists, add to SymmVM.state.params
            SymmVM.state.params.push({
                ISIN: leaf.params.ISIN,
                type: leaf.params.type,
                avgEntryPrice: close,
                amount: leaf.params.amount
            });
        }
    },
  
    marginSettlement: () => {
        console.log('Verifying input with params:', open.params, 'and root:', open.root);
        
    },

    verifyPrice: () => {
        console.log('Verifying price');
    },

    getState: () => {
        return this.state;
    },

    // verify no liquidation happened and increment timestamp
    incrementTimestamp: (params, timestamp, state) => {
        const computePnlAndVarMargin = (high, low, close, avgEntryPrice, amount, IM) => {
            const pnlClose = (close - avgEntryPrice) * amount;
            const pnlHigh = (high - avgEntryPrice) * amount;
            const pnlLow = (low - avgEntryPrice) * amount;
        
            const varMarginClose = amount * IM * (avgEntryPrice - close);
            const varMarginHigh = amount * IM * (avgEntryPrice - high);
            const varMarginLow = amount * IM * (avgEntryPrice - low);
        
            return {
                pnlClose, pnlHigh, pnlLow,
                varMarginClose, varMarginHigh, varMarginLow
            };
        };
        
        const { open, high, low, close } = priceAPI.getPrice(state.params.ISIN, timestamp);
        const {
            pnlClose: pnlA, pnlHigh: highPnlA, pnlLow: lowPnlA,
            varMarginClose: varMarginA, varMarginHigh: highVarMarginA, varMarginLow: lowVarMarginA
        } = computePnlAndVarMargin(high, low, close, state.params.avgEntryPrice, state.params.amount, state.params.IM_A);
        const {
            pnlClose: pnlB, pnlHigh: highPnlB, pnlLow: lowPnlB,
            varMarginClose: varMarginB, varMarginHigh: highVarMarginB, varMarginLow: lowVarMarginB
        } = computePnlAndVarMargin(high, low, close, state.params.avgEntryPrice, state.params.amount, state.params.IM_B);
        let isDefault = false;
        if (state.params.side == true) {

            if (Math.abs(lowVarMarginA + lowPnlA) > Math.abs(state.IM_A) && lowVarMarginA + lowPnlA < 0) {
                state.reconciliation.push({
                    type: 'default',
                    side: 'A', 
                });
                state.IM_A += state.IM_B;
                state.IM_B = 0;
                isDefault = true;
            }
            if (Math.abs(highVarMarginB + highPnlB) > Math.abs(state.IM_B) && highVarMarginB + highPnlB < 0) {
                state.reconciliation.push({
                    type: 'default',
                    side: 'B',
                });
                state.IM_B += state.IM_A;
                state.IM_A = 0;
                isDefault = true;
            }
            if (!isDefault) {
                state.IM_A += varMarginA + pnlA;
                state.IM_B += varMarginB + pnlB;
            }
        } else {
            if (Math.abs(lowVarMarginB + lowPnlB) > Math.abs(state.IM_B) && lowVarMarginB + lowPnlB < 0) {
                state.reconciliation.push({
                    type: 'default',
                    side: 'B',
                });
                state.IM_B += state.IM_A;
                state.IM_A = 0;
                isDefault = true;
            }
            if (Math.abs(highVarMarginA + highPnlA) > Math.abs(state.IM_A) && highVarMarginA + highPnlA < 0) {
                state.reconciliation.push({
                    type: 'default',
                    side: 'A',
                });
                state.IM_A += state.IM_B;
                state.IM_B = 0;
                isDefault = true;
            }
            if (!isDefault) {
                state.IM_A += varMarginA + pnlA;
                state.IM_B += varMarginB + pnlB;
            }
        }
        state.params.avgEntryPrice = close;
        state.timestamp = timestamp;
        return { params, state };
    }
};

module.exports = pSymmVM;
  