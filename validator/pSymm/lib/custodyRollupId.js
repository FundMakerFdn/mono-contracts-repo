const { keccak256, encodePacked } = require("viem");

/**
 * Simulates the getRollupBytes32 Solidity function off-chain using viem.
 * @param {string} a - The first Ethereum address.
 * @param {string} b - The second Ethereum address.
 * @param {number|string|BigInt} id - The ID to be included in the hash.
 * @returns {string} The resulting bytes32 hash as a string.
 */
function getRollupBytes32(a, b, id) {
    // Convert id to BigInt if it's not already
    const idBigInt = BigInt(id);
    // Compute the keccak256 hash of the concatenated inputs
    const hash = keccak256(encodePacked(['address', 'address', 'uint256'], [a, b, idBigInt]));

    return hash;
}

// Export the function
module.exports = { getRollupBytes32 };
