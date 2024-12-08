const { encodeAbiParameters, keccak256, toHex } = require("viem");

/**
 * @typedef {import('./custodyRollup.types').RfqSwapOpenParams} RfqSwapOpenParams
 * @typedef {import('./custodyRollup.types').RfqFillSwapOpenParams} RfqFillSwapOpenParams
 * @typedef {import('./custodyRollup.types').custodyInitVanillaParams} CustodyInitVanillaParams
 * @typedef {import('./custodyRollup.types').custodyDepositErc20Params} CustodyDepositErc20Params
 * @typedef {import('./custodyRollup.types').QuoteSwapOpenParams} QuoteSwapOpenParams
 * @typedef {import('./custodyRollup.types').QuoteFillSwapOpenParams} QuoteFillSwapOpenParams
 * @typedef {import('./custodyRollup.types').MarginCallSwapOpenParams} MarginCallSwapOpenParams
 * @typedef {import('./custodyRollup.types').custodyWithdrawErc20Params} CustodyWithdrawErc20Params
 */

class CustodyRollupTreeBuilder {
  constructor(domain) {
    this.messages = [];
    this.EIP712_DOMAIN = domain;
  }

  // Helper to create the type data for EIP712 signing
  _createTypeData(message) {
    const types = {
      // Common fields across all types
      Common: [
        { name: "type", type: "string" },
        { name: "timestamp", type: "string" },
        { name: "nonce", type: "string" },
      ],
      // Specific types based on message type
      "custody/init/vanilla": [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyId", type: "bytes32" },
        { name: "settlementAddress", type: "address" },
        { name: "MA", type: "address" },
        { name: "isManaged", type: "string" },
        { name: "expiration", type: "string" },
      ],
      "custody/deposit/erc20": [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyId", type: "string" },
        { name: "collateralAmount", type: "string" },
        { name: "collateralToken", type: "address" },
        { name: "expiration", type: "string" },
      ],
      "rfq/swap/open": [
        { name: "ISIN", type: "string" },
        { name: "amount", type: "string" },
        { name: "price", type: "string" },
        { name: "side", type: "string" },
        { name: "fundingRate", type: "string" },
        { name: "IM_A", type: "string" },
        { name: "IM_B", type: "string" },
        { name: "MM_A", type: "string" },
        { name: "MM_B", type: "string" },
        { name: "CVA_A", type: "string" },
        { name: "CVA_B", type: "string" },
        { name: "MC_A", type: "string" },
        { name: "MC_B", type: "string" },
        { name: "contractExpiry", type: "string" },
        { name: "pricePrecision", type: "string" },
        { name: "fundingRatePrecision", type: "string" },
        { name: "cancelGracePeriod", type: "string" },
        { name: "minContractAmount", type: "string" },
        { name: "oracleType", type: "string" },
        { name: "expiration", type: "string" },
      ],
      "rfqFill/swap/open": [
        { name: "amount", type: "string" },
        { name: "price", type: "string" },
        { name: "rfqNonce", type: "string" },
      ],
      "quote/swap/open": [
        { name: "assetName", type: "string" },
        { name: "amount", type: "string" },
        { name: "price", type: "string" },
        { name: "side", type: "string" },
        { name: "rfqFillNonce", type: "string" },
      ],
      "quoteFill/swap/open": [
        { name: "assetName", type: "string" },
        { name: "amount", type: "string" },
        { name: "price", type: "string" },
        { name: "side", type: "string" },
        { name: "quoteNonce", type: "string" },
      ],
      "marginCall/swap/open": [{ name: "quoteNonce", type: "string" }],
    };

    return {
      domain: this.EIP712_DOMAIN,
      types,
      primaryType: message.type,
      message,
    };
  }

  // Add a new message to the tree
  /**
   * @param {RfqSwapOpenParams|RfqFillSwapOpenParams|CustodyInitVanillaParams|CustodyDepositErc20Params|QuoteSwapOpenParams|QuoteFillSwapOpenParams|MarginCallSwapOpenParams|CustodyWithdrawErc20Params} params
   * @param {string|null} signature
   * @returns {Promise<string>} messageHash
   */
  async addMessage(params, signature = null) {
    const message = {
      signatures: signature ? [signature] : [],
      params,
    };

    // Generate hash for the message
    const typeData = this._createTypeData(params);
    // Convert any BigInts to strings before stringification
    const stringifiedTypeData = JSON.parse(JSON.stringify(typeData, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    
    const messageHash = keccak256(
      encodeAbiParameters([{ type: "bytes" }], [JSON.stringify(stringifiedTypeData)])
    );

    message.messageHash = messageHash;
    this.messages.push(message);
    return messageHash;
  }

  // Add a counterparty signature to a message
  /**
   * @param {string} messageHash
   * @param {string} signature
   */
  addSignature(messageHash, signature) {
    const message = this.messages.find((m) => m.messageHash === messageHash);
    if (!message) {
      throw new Error("Message not found");
    }

    if (!message.signatures.includes(signature)) {
      message.signatures.push(signature);
    }
  }

  // Get the current state of the message tree
  getTree() {
    return this.messages.map(({ signatures, params }) => ({
      signatures,
      params,
    }));
  }

  // Validate that a message has all required signatures
  isMessageFullySigned(messageHash) {
    const message = this.messages.find((m) => m.messageHash === messageHash);
    return message && message.signatures.length === 2;
  }

  // Clear all messages
  clear() {
    this.messages = [];
  }

  // Set the domain for EIP712 signing
  setDomain(name, version, chainId, verifyingContract) {
    this.EIP712_DOMAIN = {
      name,
      version,
      chainId,
      verifyingContract,
    };
  }

  getDomain() {
    return this.EIP712_DOMAIN;
  }

  getTypes() {
    return {
      createCustodyParams: [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyId", type: "uint256" },
        { name: "settlementAddress", type: "address" },
        { name: "MA", type: "bytes32" },
        { name: "isManaged", type: "bool" },
        { name: "expiration", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "nonce", type: "bytes32" }
      ]
    };
  }
}

module.exports = CustodyRollupTreeBuilder;
