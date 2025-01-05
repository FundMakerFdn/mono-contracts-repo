// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library EIP712SignatureChecker {
	using ECDSA for bytes32;

	struct createCustodyParams {
		bytes signatureA;
		bytes signatureB;
		address partyA;
		address partyB;
		uint256 custodyId;
		address settlementAddress;
		bytes32 MA;
		bool isManaged;
		uint8 custodyType;
		uint256 expiration;
		uint256 timestamp;
		uint256 partyId;
		uint256 nonce;
	}

	struct transferCustodyParams {
		bool isAdd;
		bytes signatureA;
		bytes signatureB;
		address partyA;
		address partyB;
		uint256 custodyId;
		uint256 collateralAmount;
		address collateralToken;
		uint256 expiration;
		uint256 timestamp;
		uint256 partyId;
		uint256 nonce;
	}

	struct updateMAParams {
		bytes signatureA;
		bytes signatureB;
		address partyA;
		address partyB;
		uint256 custodyId;
		bytes32 MA;
		uint256 expiration;
		uint256 timestamp;
		uint256 partyId;
		uint256 nonce;
	}

	bytes32 private constant CREATE_CUSTODY_TYPEHASH = keccak256(
		"createCustodyParams(address partyA,address partyB,uint256 custodyId,address settlementAddress,bytes32 MA,bool isManaged,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)"
	);

	bytes32 private constant TRANSFER_CUSTODY_TYPEHASH = keccak256(
		"transferCustodyParams(bool isAdd,address partyA,address partyB,uint256 custodyId,uint256 collateralAmount,address collateralToken,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)"
	);

	bytes32 private constant UPDATE_MA_TYPEHASH = keccak256(
		"updateMAParams(address partyA,address partyB,uint256 custodyId,bytes32 MA,uint256 expiration,uint256 timestamp,uint256 partyId,uint256 nonce)"
	);

	function verifyCreateCustodyEIP712(createCustodyParams memory params) internal pure returns (bool) {
		bytes32 structHash = keccak256(
			abi.encode(
				CREATE_CUSTODY_TYPEHASH,
				params.partyA,
				params.partyB,
				params.custodyId,
				params.settlementAddress,   
				params.MA,
				params.isManaged,
				params.custodyType,
				params.expiration,
				params.timestamp,
				params.partyId,
				params.nonce
		)
		);
		console.log("struct hash");
		console.logBytes32(structHash);

		require(
			verifySignature(
				structHash, 
				abi.encodePacked(params.signatureA), 
				abi.encodePacked(params.signatureB), 
				params.partyA, 
				params.partyB
		),
		"Invalid signature"
		);

		return true;
	}

	function verifyTransferCustodyEIP712(transferCustodyParams memory params) internal pure returns (bool) {
		bytes32 structHashSender = keccak256(
			abi.encode(
				TRANSFER_CUSTODY_TYPEHASH,
				params.isAdd,
				params.partyA,
				params.partyB,
				params.custodyId,
				params.collateralAmount,
				params.collateralToken,
				params.expiration,
				params.timestamp,
				params.partyId,
				params.nonce
		)
		);
		console.log("structHashSender");
		console.logBytes32(structHashSender);
		// console.log("custody ID: %d", params.custodyId);

		require(
			verifySignature(
				structHashSender, 
				abi.encodePacked(params.signatureA), 
				abi.encodePacked(params.signatureB), 
				params.partyA, 
				params.partyB
		),
		"Invalid signature"
		);

		return true;
	}

	function verifyUpdateMAEIP712(updateMAParams memory params) internal pure returns (bool) {
		bytes32 structHash = keccak256(
			abi.encode(
				UPDATE_MA_TYPEHASH,
				params.partyA,
				params.partyB,
				params.custodyId,
				params.MA,
				params.expiration,
				params.timestamp,
				params.partyId,
				params.nonce
		)
		);

		require(
			verifySignature(
				structHash, 
				abi.encodePacked(params.signatureA), 
				abi.encodePacked(params.signatureB), 
				params.partyA, 
				params.partyB
		),
		"Invalid signature"
		);

		return true;
	}

	function verifySignature(
		bytes32 structHash,
		bytes memory signatureA,
		bytes memory signatureB,
		address expectedSignerA,
		address expectedSignerB
	) internal pure returns (bool) {
		require(_verifySignature(structHash, signatureA, expectedSignerA), "Invalid signature A");
		require(_verifySignature(structHash, signatureB, expectedSignerB), "Invalid signature B");
		return true;
	}

	function _verifySignature(
		bytes32 hash,
		bytes memory signature,
		address expectedSigner
	) internal pure returns (bool) {
		console.log("Verifying signature:");
		console.log("Hash:", uint256(hash));
		console.log("Expected signer:", expectedSigner);
		console.log("Signature length:", signature.length);

		// Add EIP-191 prefix to match Viem's behavior
		bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));

		address recoveredSigner = ECDSA.recover(prefixedHash, signature);
		console.log("Recovered signer:", recoveredSigner);

		return recoveredSigner == expectedSigner;
	}
}
