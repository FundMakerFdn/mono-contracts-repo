import { PriceGenerator } from './lib/getPrice.js';


export class pSymmVM {
    constructor() {
        this.state = {
            partyA : '',
            partyB : '',
            timestamp: 0,
            IM_A: 0,
            IM_B: 0,
            params: [],
            avgMM_A: [],
            avgMM_B: [],
            avgMC_A: [],
            avgMC_B: [],
            reconciliation: []
        }
    }

    addPosition(leaf) {
        const [leafType, subType, action] = leaf.params.type.split('/');
        const modulePath = `./${leafType}/${subType}/SymmVM.js`;
        actionModule.default.init(this.state, leaf, this.root);
        this.state.params = actionModule.default.getState().params;
    }

    deposit(isA, amount, timestamp) {
        this.state.timestamp = timestamp;
        this.state.IM_A += isA ? amount : 0;
        this.state.IM_B += isA ? 0 : amount;
    }

    withdraw(isA, amount, timestamp) {
        this.state.timestamp = timestamp;
        this.state.IM_A -= isA ? amount : 0;
        this.state.IM_B -= isA ? 0 : amount;
    }

    incrementTimestamp(timestamp) {
        for (let i = 0; i < this.state.params.length; i++) {
            const [leafType, subType, action] = this.state.params[i].type.split('/');
            const modulePath = `./${leafType}/${subType}/SymmVM.js`;
            const { params, state, reconciliation } = actionModule.default.incrementTimestamp(this.state.params[i], timestamp, this.state);
            this.state.params[ i] = params;
            this.state = state;
        }
        
        this.state.timestamp = timestamp;
    }
}