// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library EIP712SignatureChecker {
    using ECDSA for bytes32;

    struct createCustodyParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyId;
        address settlementAddress;
        bytes32 MA;
        bool isManaged;
        uint256 expiration;
        uint256 timestamp;
        bytes32 nonce;
    }

    struct transferToCustodyParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyId;
        uint256 collateralAmount;
        address collateralToken;
        bytes32 senderCustodyId;
        uint256 expiration;
        uint256 timestamp;
        bytes32 nonce;
    }

    struct updateMAParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyId;
        bytes32 MA;
        uint256 expiration;
        uint256 timestamp;
        bytes32 nonce;
    }

    bytes32 private constant CREATE_CUSTODY_TYPEHASH = keccak256(
        "createCustodyParams(address partyA,address partyB,uint256 custodyId,address settlementAddress,bytes32 MA,bool isManaged,uint256 expiration,uint256 timestamp,bytes32 nonce)"
    );

    bytes32 private constant TRANSFER_TO_CUSTODY_TYPEHASH = keccak256(
        "transferToCustodyParams(address partyA,address partyB,uint256 custodyId,uint256 collateralAmount,address collateralToken,uint256 expiration,uint256 timestamp,bytes32 nonce)"
    );

    bytes32 private constant UPDATE_MA_TYPEHASH = keccak256(
        "updateMAParams(address partyA,address partyB,uint256 custodyId,bytes32 MA,uint256 expiration,uint256 timestamp,bytes32 nonce)"
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
                params.expiration,
                params.timestamp,
                keccak256(abi.encodePacked(params.nonce))
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

    function verifyTransferToCustodyEIP712(transferToCustodyParams memory params) internal pure returns (bool) {
        bytes32 structHashSender = keccak256(
            abi.encode(
                TRANSFER_TO_CUSTODY_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyId,
                params.collateralAmount,
                params.collateralToken,
                params.expiration,
                params.timestamp,
                keccak256(abi.encodePacked(params.nonce))
            )
        );

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
                keccak256(abi.encodePacked(params.nonce))
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
        address recoveredSigner = ECDSA.recover(hash, signature);
        return recoveredSigner == expectedSigner;
    }
}
