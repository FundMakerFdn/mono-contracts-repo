const { encodeAbiParameters, keccak256, parseEther } = require("viem");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

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

  async addMessage(params, signature = null) {
    let structHash;

    if (params.type === "initialize/billateral/standard") {
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
            { type: "uint256" }, // expiration
            { type: "uint256" }, // timestamp
            { type: "uint256" }, // partyId
            { type: "uint256" }, // nonce
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
      console.log("structHash", structHash);
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
            { type: "uint256" }, // expiration
            { type: "uint256" }, // timestamp
            { type: "uint256" }, // partyId
            { type: "uint256" }, // nonce
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
      console.log("structHash", structHash);
    }

    const message = {
      signatures: signature ? [signature] : [],
      params,
      messageHash: structHash,
    };

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
    // Convert messages to leaf format
    const leaves = this.messages.map((message) => {
      const params = message.params;

      switch (params.type) {
        case "initialize/billateral/standard":
          return [
            params.type,
            params.partyA,
            params.partyB,
            BigInt(params.custodyId),
            params.settlementAddress,
            params.MA,
            params.isManaged,
            BigInt(params.expiration),
            BigInt(params.timestamp),
            params.nonce,
          ];

        case "transfer/deposit/ERC20":
        case "transfer/withdraw/ERC20":
          return [
            params.type,
            params.partyA,
            params.partyB,
            BigInt(params.custodyId),
            params.collateralToken,
            "0x" + "0".repeat(64), // Empty bytes32 for unused MA field
            params.isAdd,
            BigInt(params.expiration),
            BigInt(params.timestamp),
            params.nonce,
          ];

        default:
          throw new Error(`Unsupported message type: ${params.type}`);
      }
    });

    // Define the types for the tree
    const types = [
      "string", // type
      "address", // partyA
      "address", // partyB
      "uint256", // custodyId
      "address", // settlementAddress/collateralToken
      "bytes32", // MA/unused
      "bool", // isManaged/isAdd
      "uint256", // expiration
      "uint256", // timestamp
      "uint256", // nonce
    ];

    // Create and return merkle root
    const tree = StandardMerkleTree.of(leaves, types);
    return tree.root;
  }
}

module.exports = CustodyRollupTreeBuilder;
