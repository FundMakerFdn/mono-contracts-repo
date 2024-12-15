const { encodeAbiParameters, keccak256, parseEther } = require("viem");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

function deterministicStringify(obj) {
  // Sort arrays if present (including signatures array)
  if (Array.isArray(obj)) {
    return JSON.stringify(obj.sort());
  }

  // Get all keys and sort them
  const sortedKeys = Object.keys(obj).sort();

  // Build new object with sorted keys
  const sortedObj = {};
  sortedKeys.forEach((key) => {
    const value = obj[key];
    // Recursively handle nested objects and arrays
    if (typeof value === "object" && value !== null) {
      sortedObj[key] = deterministicStringify(value);
    } else {
      sortedObj[key] = value;
    }
  });

  return JSON.stringify(sortedObj);
}

class CustodyRollupTreeBuilder {
  constructor() {
    this.messages = [];
  }

  static CREATE_CUSTODY_TYPEHASH = keccak256(
    "createCustodyParams(address partyA,address partyB,uint256 custodyId,address settlementAddress,bytes32 MA,bool isManaged,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)"
  );

  static TRANSFER_CUSTODY_TYPEHASH = keccak256(
    "transferCustodyParams(bool isAdd,address partyA,address partyB,uint256 custodyId,uint256 collateralAmount,address collateralToken,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)"
  );

  static UPDATE_MA_TYPEHASH = keccak256(
    "updateMAParams(address partyA,address partyB,uint256 custodyId,bytes32 MA,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)"
  );

  static RFQ_TYPE = [
    { name: "partyA", type: "address" },
    { name: "partyB", type: "address" },
    { name: "custodyId", type: "uint256" },
    { name: "partyId", type: "uint256" },
    { name: "ISIN", type: "string" },
    { name: "amount", type: "uint256" },
    { name: "price", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "fundingRate", type: "int256" },
    { name: "IM_A", type: "uint256" },
    { name: "IM_B", type: "uint256" },
    { name: "MM_A", type: "uint256" },
    { name: "MM_B", type: "uint256" },
    { name: "CVA_A", type: "uint256" },
    { name: "CVA_B", type: "uint256" },
    { name: "MC_A", type: "uint256" },
    { name: "MC_B", type: "uint256" },
    { name: "contractExpiry", type: "uint256" },
    { name: "pricePrecision", type: "uint8" },
    { name: "fundingRatePrecision", type: "uint8" },
    { name: "cancelGracePeriod", type: "uint256" },
    { name: "minContractAmount", type: "uint256" },
    { name: "oracleType", type: "uint8" },
    { name: "expiration", type: "uint256" },
    { name: "timestamp", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ];
  // RFQ and Quote message types don't use typehashes
  static RFQ_MESSAGE_TYPES = {
    "rfq/open/perps": CustodyRollupTreeBuilder.RFQ_TYPE,
    "rfqFill/open/perps": CustodyRollupTreeBuilder.RFQ_TYPE,
  };

  static FOOTER_CUSTODY_TYPES = [
    { type: "uint256" }, // expiration
    { type: "uint256" }, // timestamp
    { type: "uint256" }, // partyId
    { type: "uint256" }, // nonce
  ];

  async addMessage(params, signature = null) {
    const message = {
      signatures: [],
      params,
      messageHash: null,
    };

    // Calculate messageHash for signatures
    let structHash;

    // Handle RFQ and Quote message types without typehash
    if (
      Object.keys(CustodyRollupTreeBuilder.RFQ_MESSAGE_TYPES).includes(
        params.type
      )
    ) {
      const messageFields =
        CustodyRollupTreeBuilder.RFQ_MESSAGE_TYPES[params.type];
      const messageValues = messageFields.map((field) => params[field]);
      structHash = keccak256(
        encodeAbiParameters(
          messageFields.map((field) => ({
            type: typeof params[field] === "boolean" ? "bool" : "string",
          })),
          messageValues
        )
      );
    } else if (params.type === "initialize/billateral/standard") {
      structHash = keccak256(
        encodeAbiParameters(
          [
            { type: "bytes32" }, // typehash
            { type: "address" }, // partyA
            { type: "address" }, // partyB
            { type: "uint256" }, // custodyId
            { type: "address" }, // settlementAddress
            { type: "bytes32" }, // MA
            { type: "bool" }, // isManaged
            ...CustodyRollupTreeBuilder.FOOTER_CUSTODY_TYPES,
          ],
          [
            CustodyRollupTreeBuilder.CREATE_CUSTODY_TYPEHASH,
            params.partyA,
            params.partyB,
            BigInt(params.custodyId),
            params.settlementAddress,
            params.MA,
            params.isManaged,
            BigInt(params.expiration),
            BigInt(params.timestamp),
            BigInt(params.partyId),
            BigInt(params.nonce),
          ]
        )
      );
    } else if (
      ["transfer/deposit/ERC20", "transfer/withdraw/ERC20"].includes(
        params.type
      )
    ) {
      structHash = keccak256(
        encodeAbiParameters(
          [
            { type: "bytes32" }, // typehash
            { type: "bool" }, // isAdd
            { type: "address" }, // partyA
            { type: "address" }, // partyB
            { type: "uint256" }, // custodyId
            { type: "uint256" }, // collateralAmount
            { type: "address" }, // collateralToken
            ...CustodyRollupTreeBuilder.FOOTER_CUSTODY_TYPES,
          ],
          [
            CustodyRollupTreeBuilder.TRANSFER_CUSTODY_TYPEHASH,
            params.isAdd,
            params.partyA,
            params.partyB,
            BigInt(params.custodyId),
            parseEther(params.collateralAmount),
            params.collateralToken,
            BigInt(params.expiration),
            BigInt(params.timestamp),
            BigInt(params.partyId),
            BigInt(params.nonce),
          ]
        )
      );
    }

    message.messageHash = structHash;
    if (signature) {
      message.signatures.push(signature);
    }

    this.messages.push(message);
    return structHash;
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
      Message: [
        { name: "type", type: "string" },
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyId", type: "string" },
        { name: "settlementAddress", type: "address" },
        { name: "MA", type: "bytes32" },
        { name: "isManaged", type: "string" },
        { name: "expiration", type: "string" },
        { name: "timestamp", type: "string" },
        { name: "nonce", type: "bytes32" },
      ],
    };
  }

  getMerkleRoot() {
    // Convert messages to deterministic JSON strings
    const leaves = this.messages.map((message) => {
      // Create clean object with just signatures and params
      const leafObj = {
        signatures: [...message.signatures].sort(), // Sort signatures array
        params: message.params,
      };

      // Convert to deterministic string
      return [deterministicStringify(leafObj)];
    });

    // Create tree with just string type
    const tree = StandardMerkleTree.of(leaves, ["string"]);
    return tree.root;
  }
}

module.exports = CustodyRollupTreeBuilder;
