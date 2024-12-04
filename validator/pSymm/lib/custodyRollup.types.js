/**
 * @typedef {Object} RfqSwapOpenParams
 * @property {string} type
 * @property {string} ISIN
 * @property {string} amount
 * @property {string} price
 * @property {string} side
 * @property {string} fundingRate
 * @property {string} IM_A
 * @property {string} IM_B
 * @property {string} MM_A
 * @property {string} MM_B
 * @property {string} CVA_A
 * @property {string} CVA_B
 * @property {string} MC_A
 * @property {string} MC_B
 * @property {string} contractExpiry
 * @property {string} pricePrecision
 * @property {string} fundingRatePrecision
 * @property {string} cancelGracePeriod
 * @property {string} minContractAmount
 * @property {string} oracleType
 * @property {string} expiration
 * @property {string} nonce
 * @property {string} timestamp
 */

/**
 * @typedef {Object} RfqFillSwapOpenParams
 * @property {string} type
 * @property {string} amount
 * @property {string} price
 * @property {string} rfqNonce
 * @property {string} nonce
 * @property {string} timestamp
 */

/**
 * @typedef {Object} custodyInitVanillaParams
 * @property {string} type
 * @property {string} partyA
 * @property {string} partyB
 * @property {string} custodyId
 * @property {string} settlementAddress
 * @property {string} MA
 * @property {string} isManaged
 * @property {string} expiration
 * @property {string} timestamp
 * @property {string} nonce
 */

/**
 * @typedef {Object} custodyDepositErc20Params
 * @property {string} type
 * @property {string} partyA
 * @property {string} partyB
 * @property {string} custodyId
 * @property {string} collateralAmount
 * @property {string} collateralToken
 * @property {string} expiration
 * @property {string} timestamp
 * @property {string} nonce
 */

/**
 * @typedef {Object} QuoteSwapOpenParams
 * @property {string} type
 * @property {string} assetName
 * @property {string} amount
 * @property {string} price
 * @property {string} side
 * @property {string} rfqFillNonce
 * @property {string} nonce
 * @property {string} timestamp
 */

/**
 * @typedef {Object} QuoteFillSwapOpenParams
 * @property {string} type
 * @property {string} assetName
 * @property {string} amount
 * @property {string} price
 * @property {string} side
 * @property {string} quoteNonce
 * @property {string} nonce
 * @property {string} timestamp
 */

/**
 * @typedef {Object} MarginCallSwapOpenParams
 * @property {string} type
 * @property {string} quoteNonce
 * @property {string} nonce
 * @property {string} timestamp
 */

/**
 * @typedef {Object} custodyWithdrawErc20Params
 * @property {string} type
 * @property {string} partyA
 * @property {string} partyB
 * @property {string} custodyId
 * @property {string} collateralAmount
 * @property {string} collateralToken
 * @property {string} expiration
 * @property {string} timestamp
 * @property {string} nonce
 */

/**
 * @typedef {Object} JsonObject
 * @property {string[]} signatures
 * @property {RfqSwapOpenParams|RfqFillSwapOpenParams|CustodyInitVanillaParams|CustodyDepositErc20Params|QuoteSwapOpenParams|QuoteFillSwapOpenParams|MarginCallSwapOpenParams|CustodyWithdrawErc20Params} params
 */

/**
 * @type {JsonObject[]}
 */
const jsonArray = [
    // Your JSON data here
];
