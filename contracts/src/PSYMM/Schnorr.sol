//SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.0;

library Schnorr {
    // secp256k1 group order
    uint256 constant internal Q =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

	// PPMKey - a flexible struct for Ethereum address & Schnorr public key
	struct PPMKey {
		uint8 parity; // for ETH = 0, for Schnorr is y-coord parity
		bytes32 x; // if ETH, ethAddress = address(uint160(uint256(key.x)))
	}

    struct Signature {
        bytes32 e;       // challenge
        bytes32 s;       // signature value
    }

    // parity := public key y-coord parity (27 or 28)
    // px := public key x-coord
    // message := 32-byte message
    // e := schnorr signature challenge
    // s := schnorr signature
    function verifySignature(
        uint8 parity,
        bytes32 px,
        bytes32 message,
        bytes32 e,
        bytes32 s
    ) internal pure returns (bool) {
        // ecrecover = (m, v, r, s);
        bytes32 sp = bytes32(Q - mulmod(uint256(s), uint256(px), Q));
        bytes32 ep = bytes32(Q - mulmod(uint256(e), uint256(px), Q));

        require(sp != 0);
        // the ecrecover precompile implementation checks that the `r` and `s`
        // inputs are non-zero (in this case, `px` and `ep`), thus we don't need to
        // check if they're zero.
        address R = ecrecover(sp, parity, px, ep);
        require(R != address(0), "ecrecover failed");
        return e == keccak256(
            abi.encodePacked(R, uint8(parity), px, message)
        );
    }

    function verify(PPMKey calldata key, bytes32 message, Signature calldata sig) internal view returns (bool) {
        // case where sender is a whitelisted contract
		if (key.parity == 0) {
			return msg.sender == address(uint160(uint256(key.x)));
		} else {
			return verifySignature(
				key.parity,
				key.x,
				message,
				sig.e,
				sig.s
			);
		}
    }
}
