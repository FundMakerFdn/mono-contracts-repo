const { getRollupBytes32 } = require('../../../contract/utils/custodyRollupId.js');


// simulation of json between 2 parties

const custodyRollupId = getRollupBytes32(partyA, partyB, id);
// if not exist, create a json in ./custodyRollupId/partyAAddress/custodyRollupId.json and ./custodyRollupId/partyBAddress/custodyRollupId.json
// if exist, read the json

// usage
// const rollupA = new CustodyRollupTree(addressA, addressB, custodyRollupId);
// rollupA.auth(isA, viemAccount with private key)
// rollupA.newTx("rfa/swap/open").param(ISIN, "BTC").param(amount, 1000000000000000000).param(price, 1000000000000000000).param(side, "buy").param(fundingRate, 1).param(IM_A, 1000000000000000000).param(IM_B, 1000000000000000000).param(MM_A, 1000000000000000000).param(MM_B, 1000000000000000000).param(CVA_A, 1000000000000000000).param(CVA_B, 1000000000000000000).param(MC_A, 1000000000000000000).param(MC_B, 1000000000000000000).param(contractExpiry, 1723232323232).param(pricePrecision, 3).param(fundingRatePrecision, 3).param(cancelGracePeriod, 30000).param(minContractAmount, 10).param(oracleType, "mock").param(expiration, Date.now() + 1000000).param(timestamp, Date.now());
// .sign(address)
// .build() // if nonce not defined set the nonce, if addressA is signer set 0xA, if addressB is signer set 0xB, then number like 0xA0, 0xB3, 0xA9, 0xB10, ...
// .send() // sends to counterparty json in ./custodyRollupId/counterpartyAddress/custodyRollupId.json

// rollupB.nonce('0xA0').verify().sign(addressB).build().send() // add signature in counterparty tx cf example bellow
// rollupB.newTx("rfqFill/swap/open").param(amount, 1000000000000000000).param(price, 1000000000000000000).param(rfqNonce, "0xA0").param(timestamp, Date.now());
// rollupA.nonce('0xB1').verify().sign(addressA).build().send() // add signature in partyA tx cf example bellow



/* ex structure of a Tree, signatures are in array [0] for partyA and [1] for partyB
[
    {
        "signatures": [
            "0xB234567890123456789012345678901234567890",
            "0xB234567890123456789012345678901234567890"
        ],
        "params": {
            "type": "rfq/swap/open",
            "ISIN": "BTC",
            "amount": "1000000000000000000",
            "price": "1000000000000000000",
            "side": "buy",
            "fundingRate": "1",
            "IM_A": "1000000000000000000",
            "IM_B": "1000000000000000000",
            "MM_A": "1000000000000000000",
            "MM_B": "1000000000000000000",
            "CVA_A": "1000000000000000000",
            "CVA_B": "1000000000000000000",
            "MC_A": "1000000000000000000",
            "MC_B": "1000000000000000000",
            "contractExpiry": "1723232323232",
            "pricePrecision": "3",
            "fundingRatePrecision": "3",
            "cancelGracePeriod": "30000",
            "minContractAmount": "10",
            "oracleType": "mock",
            "expiration": "1723232323232",
            "nonce": "0xA0",
            "timestamp": "1723232323232"
        }
    },
    {
        "signatures": [
            "0xB234567890123456789012345678901234567890",
            "0xB234567890123456789012345678901234567890"
        ],
        "params": {
            "type": "rfqFill/swap/open",
            "amount": "1000000000000000000",
            "price": "1000000000000000000",
            "rfqNonce": "0xA0",
            "nonce": "0xB1",
            "timestamp": "1723232323232"
        }
    },
]
*/

build the stack to build the thing explained in @custodyRollupTreeFlow.md , do it with viem 