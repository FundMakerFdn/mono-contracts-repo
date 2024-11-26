const { ethers } = require("ethers");

/**
 * EIP712Helper
 * A helper class to create EIP712 structured data for different initiation types.
 */
class EIP712Helper {
  /**
   * Constructor to initialize the EIP712 domain.
   * @param {string} contractAddress - The address of the smart contract.
   * @param {string} name - The user-readable name of the signing domain.
   * @param {string} version - The current major version of the signing domain.
   * @param {number} chainId - The chain ID of the network.
   */
  constructor(contractAddress, name, version, chainId) {
    this.domain = {
      name: name,
      version: version,
      chainId: chainId,
      verifyingContract: contractAddress,
    };
  }

  /**
   * Generate the EIP712 domain separator.
   * @returns {Object} The domain separator.
   */
  getDomain() {
    return this.domain;
  }

  /**
   * Create EIP712 data for Create Custody Rollup.
   * @param {Object} params - Parameters for createCustodyRollupParams.
   * @returns {Object} The EIP712 structured data.
   */
  createCustodyRollup(params) {
    const types = {
      createCustodyRollupParams: [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyRollupId", type: "uint256" },
        { name: "settlementAddress", type: "address" },
        { name: "MA", type: "bytes32" },
        { name: "isManaged", type: "bool" },
        { name: "expiration", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      partyA: params.partyA,
      partyB: params.partyB,
      custodyRollupId: params.custodyRollupId,
      settlementAddress: params.settlementAddress,
      MA: params.MA,
      isManaged: params.isManaged,
      expiration: params.expiration,
      timestamp: params.timestamp,
      nonce: params.nonce,
    };

    return {
      types,
      domain: this.getDomain(),
      primaryType: "createCustodyRollupParams",
      message: value,
    };
  }

  /**
   * Create EIP712 data for Transfer To Custody Rollup.
   * @param {Object} params - Parameters for transferToCustodyRollupParams.
   * @returns {Object} The EIP712 structured data.
   */
  transferToCustodyRollup(params) {
    const types = {
      transferToCustodyRollupParams: [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyRollupId", type: "uint256" },
        { name: "collateralAmount", type: "uint256" },
        { name: "collateralToken", type: "address" },
        { name: "expiration", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      partyA: params.partyA,
      partyB: params.partyB,
      custodyRollupId: params.custodyRollupId,
      collateralAmount: params.collateralAmount,
      collateralToken: params.collateralToken,
      expiration: params.expiration,
      timestamp: params.timestamp,
      nonce: params.nonce,
    };

    return {
      types,
      domain: this.getDomain(),
      primaryType: "transferToCustodyRollupParams",
      message: value,
    };
  }

  /**
   * Create EIP712 data for Transfer From Custody Rollup.
   * @param {Object} params - Parameters for transferFromCustodyRollupParams.
   * @returns {Object} The EIP712 structured data.
   */
  transferFromCustodyRollup(params) {
    const types = {
      transferFromCustodyRollupParams: [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyRollupId", type: "uint256" },
        { name: "collateralAmount", type: "uint256" },
        { name: "collateralToken", type: "address" },
        { name: "expiration", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      partyA: params.partyA,
      partyB: params.partyB,
      custodyRollupId: params.custodyRollupId,
      collateralAmount: params.collateralAmount,
      collateralToken: params.collateralToken,
      expiration: params.expiration,
      timestamp: params.timestamp,
      nonce: params.nonce,
    };

    return {
      types,
      domain: this.getDomain(),
      primaryType: "transferFromCustodyRollupParams",
      message: value,
    };
  }

  /**
   * Create EIP712 data for Update MA.
   * @param {Object} params - Parameters for updateMAParams.
   * @returns {Object} The EIP712 structured data.
   */
  updateMA(params) {
    const types = {
      updateMAParams: [
        { name: "partyA", type: "address" },
        { name: "partyB", type: "address" },
        { name: "custodyRollupId", type: "uint256" },
        { name: "MA", type: "bytes32" },
        { name: "expiration", type: "uint256" },
        { name: "timestamp", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      partyA: params.partyA,
      partyB: params.partyB,
      custodyRollupId: params.custodyRollupId,
      MA: params.MA,
      expiration: params.expiration,
      timestamp: params.timestamp,
      nonce: params.nonce,
    };

    return {
      types,
      domain: this.getDomain(),
      primaryType: "updateMAParams",
      message: value,
    };
  }

  /**
   * Sign the EIP712 data with a given wallet.
   * @param {Object} eip712Data - The EIP712 structured data.
   * @param {ethers.Wallet} signer - The wallet to sign the data.
   * @returns {Promise<string>} The signature.
   */
  async sign(eip712Data, signer) {
    return await signer._signTypedData(
      eip712Data.domain,
      eip712Data.types,
      eip712Data.message
    );
  }

  /**
   * Verify the EIP712 signature.
   * @param {Object} eip712Data - The EIP712 structured data.
   * @param {string} signature - The signature to verify.
   * @param {string} expectedSigner - The expected signer's address.
   * @returns {boolean} True if the signature is valid.
   */
  verify(eip712Data, signature, expectedSigner) {
    const recoveredAddress = ethers.utils.verifyTypedData(
      eip712Data.domain,
      eip712Data.types,
      eip712Data.message,
      signature
    );
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  }
}

module.exports = EIP712Helper;

