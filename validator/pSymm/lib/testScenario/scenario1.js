


resetCustodyIdFolder();
const addressA = mockAccount[0].publicKey;
const addressB = mockAccount[1].publicKey;
const pkA = mockAccount[0].privateKey;
const pkB = mockAccount[1].privateKey;
const custodyId = 1
const collateralToken = "0xB234567890123456789012345678901234567890"
const custodyBytes32 = getRollupBytes32(addressA, addressB, custodyId);

const header= {
    "version": "1.0",
    "chainId": "3447",
    "verifyingContract": pSymmAddress,
    "partyA": addressA,
    "partyB": addressB,
    "custodyId": custodyId,
}


const rollupA = new custodyTree(addressA, addressB, custodyBytes32);
const rollupB = new custodyTree(addressB, addressA, custodyBytes32);
rollupA.auth(true, privateKeyToAccount(pkA));
rollupB.auth(false, privateKeyToAccount(pkB));

rollupA.newTx("rfq/swap/open")
    .param("header", header)
    .param("ISIN", "BTC")
    .param("amount", "100") // @flow when do we convert to uin256, or do we never since its always offchain and store it as double ?
    .param("price", "10")
    .param("side", "buy")
    .param("fundingRate", "1") // @flow everything is stored as a string offchain ( to avoid type errors ) 
    .param("IM_A", "0.075")
    .param("IM_B", "0.075")
    .param("MM_A", "0.025")
    .param("MM_B", "0.025")
    .param("CVA_A", "0.01")
    .param("CVA_B", "0.01")
    .param("MC_A", "0.05")
    .param("MC_B", "0.05")
    .param("contractExpiry", Date.now() + 1440 * 60 *  1000 * 30 * 6) // 6 months
    .param("pricePrecision", 3)
    .param("fundingRatePrecision", 3)
    .param("cancelGracePeriod", 30000)
    .param("minContractAmount", 1)
    .param("oracleType", "mock")
    .param("expiration", Date.now() + 1000 * 10 ) // 10 seconds
    .param("timestamp", Date.now())
    .param("nonce", `0xA0`) // @flow, automatic nonce set at send and receipt
    .build();

(async () => {
    await sendTransaction(true, addressA, addressB, pkA, custodyBytes32);
    await sendeReceip();
})();

// Create a new transaction with specific parameters
rollupB.newTx("rfqFill/swap/open")
    .param("header", header)
    .param("amount", "100")
    .param("price", "10")
    .param("rfqNonce", "0xA0") // @flow this one not automatic ( nonce of the rfq to answer )
    .param("expiration", Date.now() + 1000 * 10 )
    .param("timestamp", Date.now())
    .param("nonce", `0xB1`) // @flow
    .build();

(async () => {
    await sendTransaction(false, addressB, addressA, pkB, custodyBytes32);
    await sendeReceip();
})();
// 1 swap
rollupA.newTx("rfq/swap/open")
    .param("header", header)
    .param("ISIN", "BTC")
    .param("amount", "100") 
    .param("price", "10")
    .param("side", "buy")
    .param("fundingRate", "1") 
    .param("IM_A", "0.075")
    .param("IM_B", "0.075")
    .param("MM_A", "0.025")
    .param("MM_B", "0.025")
    .param("CVA_A", "0.01")
    .param("CVA_B", "0.01")
    .param("MC_A", "0.05")
    .param("MC_B", "0.05")
    .param("contractExpiry", Date.now() + 1440 * 60 *  1000 * 30 * 6) // 6 months
    .param("pricePrecision", 3)
    .param("fundingRatePrecision", 3)
    .param("cancelGracePeriod", 30000)
    .param("minContractAmount", 1)
    .param("oracleType", "mock")
    .param("expiration", Date.now() + 1000 * 10 ) // 10 seconds
    .param("timestamp", Date.now())
    .param("nonce", `0xA0`) // @flow, automatic nonce set at send and receipt
    .build();

// 2 ho no, rollup isnt up setup
rollupA.newTx("custody/deposit/erc20")
    .eip712("TransferToCustodyParams")
    .param("header", header)
    .param("collateralAmount", "100")
    .param("collateralToken", collateralAddress )
    .param("expiration", Date.now() + 1000 * 60)
    .param("timestamp", Date.now())
    .param("nonce", `0xA2`)
    .build();

// 3 ho no, I dont have collateral on rollup
rollupA.newTx("custody/deposit/erc20")
    .eip712("TransferToCustodyParams")
    .param("header", header)
    .param("collateralAmount", "100")
    .param("collateralToken", collateralAddress )
    .param("expiration", Date.now() + 1000 * 60)
    .param("timestamp", Date.now())
    .param("nonce", `0xA2`)
    .build();``

rollupA.newTx("custody/initialize/billateral")
    .eip712("CreateCustodyParams")
    .param("header", header)
    .param("collateralAmount", "100")
    .param("collateralToken", collateralAddress )
    .param("expiration", Date.now() + 1000 * 60)
    .param("timestamp", Date.now())
    .param("nonce", `0xA2`)
    .build();



(async () => {
    await batchSendTransaction(true, addressA, addressB, pkA, custodyBytes32); // @flow todo
    await batchSendeReceip(); // @flow todo
})();
    

