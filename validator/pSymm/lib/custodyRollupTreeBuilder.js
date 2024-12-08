const { encodeAbiParameters, keccak256, parseEther } = require("viem");

class CustodyRollupTreeBuilder {
  constructor() {
    this.messages = [];
  }

  static CREATE_CUSTODY_TYPEHASH = keccak256(
    "createCustodyParams(address partyA,address partyB,uint256 custodyId,address settlementAddress,bytes32 MA,bool isManaged,uint256 expiration,uint256 timestamp,bytes32 nonce)"
  );

  static TRANSFER_TO_CUSTODY_TYPEHASH = keccak256(
    "transferToCustodyParams(address partyA,address partyB,uint256 custodyId,uint256 collateralAmount,address collateralToken,uint256 expiration,uint256 timestamp,bytes32 nonce)"
  );

  static UPDATE_MA_TYPEHASH = keccak256(
    "updateMAParams(address partyA,address partyB,uint256 custodyId,bytes32 MA,uint256 expiration,uint256 timestamp,bytes32 nonce)"
  );

  static WITHDRAW_CUSTODY_TYPEHASH = keccak256(
    "withdrawCustodyParams(address partyA,address partyB,uint256 custodyId,uint256 collateralAmount,address collateralToken,uint256 expiration,uint256 timestamp,bytes32 nonce)"
  );
  async addMessage(params, signature = null) {
    let structHash;

    if (params.type === "custody/init/vanilla") {
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
            { type: "bytes32" }, // nonce
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
            keccak256(
              encodeAbiParameters([{ type: "bytes32" }], [params.nonce])
            ),
          ]
        )
      );
      console.log("structHash", structHash);
    } else if (params.type === "custody/withdraw/erc20") {
      structHash = keccak256(
        encodeAbiParameters(
          [
            { type: "bytes32" }, // typehash
            { type: "address" }, // partyA
            { type: "address" }, // partyB
            { type: "uint256" }, // custodyId
            { type: "uint256" }, // collateralAmount
            { type: "address" }, // collateralToken
            { type: "uint256" }, // expiration
            { type: "uint256" }, // timestamp
            { type: "bytes32" }, // nonce
          ],
          [
            CustodyRollupTreeBuilder.WITHDRAW_CUSTODY_TYPEHASH,
            params.partyA,
            params.partyB,
            BigInt(params.custodyId),
            parseEther(params.collateralAmount),
            params.collateralToken,
            BigInt(params.expiration),
            BigInt(params.timestamp),
            keccak256(
              encodeAbiParameters([{ type: "bytes32" }], [params.nonce])
            ),
          ]
        )
      );
      console.log("structHash withdraw", structHash);
    } else if (params.type === "custody/deposit/erc20") {
      structHash = keccak256(
        encodeAbiParameters(
          [
            { type: "bytes32" }, // typehash
            { type: "address" }, // partyA
            { type: "address" }, // partyB
            { type: "uint256" }, // custodyId
            { type: "uint256" }, // collateralAmount
            { type: "address" }, // collateralToken
            { type: "uint256" }, // expiration
            { type: "uint256" }, // timestamp
            { type: "bytes32" }, // nonce
          ],
          [
            CustodyRollupTreeBuilder.TRANSFER_TO_CUSTODY_TYPEHASH,
            params.partyA,
            params.partyB,
            BigInt(params.custodyId),
            parseEther(params.collateralAmount),
            params.collateralToken,
            BigInt(params.expiration),
            BigInt(params.timestamp),
            keccak256(
              encodeAbiParameters([{ type: "bytes32" }], [params.nonce])
            ),
          ]
        )
      );
      console.log("structHash transfer", structHash);
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
}

module.exports = CustodyRollupTreeBuilder;
