// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library EIP712SignatureChecker {
    using ECDSA for bytes32;

    struct createCustodyRollupParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        address settlementAddress;
        bytes32 MA;
        bool isManaged;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }

    struct transferToCustodyRollupParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        uint256 collateralAmount;
        address collateralToken;
        bool isA;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }

    struct transferFromCustodyRollupParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        uint256 collateralAmount    ;
        address collateralToken;
        bool isA;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }

    struct updateMAParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        bytes32 MA;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }

    bytes32 private constant CREATE_CUSTODYROLLUP_TYPEHASH = keccak256(
        "createCustodyRollupParams(address partyA,address partyB,uint256 custodyRollupId,address settlementAddress,bytes32 MA,bool isManaged,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    bytes32 private constant TRANSFER_TO_CUSTODYROLLUP_SENDER_TYPEHASH = keccak256(
        "transferToCustodyRollupParams(address partyA,address partyB,uint256 custodyRollupId,uint256 collateralAmount,address collateralToken,bool isA,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    bytes32 private constant TRANSFER_FROM_CUSTODYROLLUP_TYPEHASH = keccak256(
        "transferFromCustodyRollupParams(address partyA,address partyB,uint256 custodyRollupId,uint256 collateralAmount,address collateralToken,bool isA,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    bytes32 private constant UPDATE_MA_TYPEHASH = keccak256(
        "updateMAParams(address partyA,address partyB,uint256 custodyRollupId,bytes32 MA,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    function verifyCreateCustodyRollupEIP712(createCustodyRollupParams memory params) internal pure returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                CREATE_CUSTODYROLLUP_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyRollupId,
                params.settlementAddress,   
                params.MA,
                params.isManaged,
                params.expiration,
                params.timestamp,
                params.nonce
            )
        );

        require(
            EIP712SignatureChecker.verifySignature(
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

    function verifyTransferToCustodyRollupEIP712( transferToCustodyRollupParams memory params) internal pure returns (bool) {
        bytes32 structHashSender = keccak256(
            abi.encode(
                TRANSFER_TO_CUSTODYROLLUP_SENDER_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyRollupId,
                params.collateralAmount,
                params.collateralToken,
                params.isA,
                params.expiration,
                params.timestamp,
                params.nonce
            )
        );

        require(
            EIP712SignatureChecker.verifySignature(
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

    function verifyTransferFromCustodyRollupEIP712(transferFromCustodyRollupParams memory params) internal pure returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_FROM_CUSTODYROLLUP_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyRollupId,
                params.collateralAmount,
                params.collateralToken,
                params.isA,
                params.expiration,
                params.timestamp,
                params.nonce
            )
        );

        require(
            EIP712SignatureChecker.verifySignature(
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

    function verifyUpdateMAEIP712(updateMAParams memory params) internal pure returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                UPDATE_MA_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyRollupId,
                params.MA,
                params.expiration,
                params.timestamp,
                params.nonce
            )
        );

        require(
            EIP712SignatureChecker.verifySignature(
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
        require(_verifySignature(structHash, signatureA, expectedSignerA), "Invalid signature");
        require(_verifySignature(structHash, signatureB, expectedSignerB), "Invalid signature");
        return true;
    }

    function _verifySignature(
        bytes32 hash,
        bytes memory signature,
        address expectedSigner
    ) internal pure returns (bool) {
        address recoveredSigner = ECDSA.recover(hash, signature);
        return recoveredSigner == expectedSigner;
    }
}