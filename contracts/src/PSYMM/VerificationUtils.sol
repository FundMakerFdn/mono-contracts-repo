// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./Schnorr.sol";

library VerificationUtils {

    
    /// @notice Verifies that the provided leaf (built from the action parameters) is part of the given Merkle root.
    /// @param ppm The Merkle root against which the leaf is verified.
    /// @param merkleProof The Merkle proof array.
    /// @param action A string identifying the action (e.g. "custodyToAddress", "updatePPM", etc.).
    /// @param chainId The chain ID.
    /// @param contractAddress The address of the current contract.
    /// @param custodyState The current custody state.
    /// @param encodedParams Encoded parameters specific to the action.
    /// @param pubKeyParity The parity value from the public key.
    /// @param pubKeyX The x-coordinate of the public key.
    function verifyLeaf(
        bytes32 ppm,
        bytes32[] memory merkleProof,
        string memory action,
        uint256 chainId,
        address contractAddress,
        uint8 custodyState,
        bytes memory encodedParams,
        uint8 pubKeyParity,
        bytes32 pubKeyX
    ) internal pure {
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(
                        action,
                        chainId,
                        contractAddress,
                        custodyState,
                        encodedParams,
                        pubKeyParity,
                        pubKeyX
                    )
                )
            )
        );
        require(MerkleProof.verify(merkleProof, ppm, leaf), "Invalid merkle proof");
    }

    /// @notice Verifies a Schnorr signature.
    /// @param messageData The ABI-encoded data that forms the basis of the message hash.
    /// @param pubKey The Schnorr public key.
    /// @param sig The Schnorr signature.
    function verifySchnorr(
        bytes memory messageData,
        Schnorr.PPMKey calldata pubKey,
        Schnorr.Signature calldata sig
    ) internal view returns (bool) {
        bytes32 message = keccak256(messageData);
        return Schnorr.verify(pubKey, message, sig);
    }
}
