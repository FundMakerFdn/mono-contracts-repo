// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "contracts/pSymm/settlement/pSymmSettlement.sol";
import "hardhat/console.sol";

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
        address collateralToken;
        uint256 tokenAmount;
        address tokenAddress;
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
        uint256 tokenAmount;
        address tokenAddress;
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
        "transferToCustodyRollupParams(address partyA,address partyB,uint256 custodyRollupId,address collateralToken,uint256 tokenAmount,address tokenAddress,bool isA,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    bytes32 private constant TRANSFER_FROM_CUSTODYROLLUP_TYPEHASH = keccak256(
        "transferFromCustodyRollupParams(address partyA,address partyB,uint256 custodyRollupId,uint256 tokenAmount,address tokenAddress,bool isA,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    bytes32 private constant UPDATE_MA_TYPEHASH = keccak256(
        "updateMAParams(address partyA,address partyB,uint256 custodyRollupId,bytes32 MA,uint256 expiration,uint256 timestamp,uint256 nonce)"
    );

    function verifyCreateCustodyRollupEIP712(createCustodyRollupParams memory params) internal view returns (bool) {
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
            EIP712SignatureChecker.verifySignature(structHash, params.signatureA, params.signatureB, params.partyA, params.partyB),
            "Invalid signature"
        );

        
    }

    function verifyTransferToCustodyRollupEIP712(bytes32 custodyRollupId, transferToCustodyRollupParams memory params) internal view returns (bool) {
        bytes32 structHashSender = keccak256(
            abi.encode(
                TRANSFER_TO_CUSTODYROLLUP_SENDER_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyRollupId,
                params.collateralToken,
                params.tokenAmount,
                params.tokenAddress,
                params.isA,
                params.expiration,
                params.timestamp,
                params.nonce
            )
        );

        require(
            EIP712SignatureChecker.verifySignature(structHashSender, params.signatureA, params.signatureB, params.partyA, params.partyB),
            "Invalid signature"
        );

        return true;
    }

    function verifyTransferFromCustodyRollupEIP712(transferFromCustodyRollupParams memory params) internal view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_FROM_CUSTODYROLLUP_TYPEHASH,
                params.partyA,
                params.partyB,
                params.custodyRollupId,
                params.tokenAmount,
                params.tokenAddress,
                params.isA,
                params.expiration,
                params.timestamp,
                params.nonce
            )
        );

        require(
            EIP712SignatureChecker.verifySignature(structHash, params.signatureA, params.signatureB, params.partyA, params.partyB),
            "Invalid signature"
        );

        return true;
    }

    function verifyUpdateMAEIP712(updateMAParams memory params) internal view returns (bool) {
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
            EIP712SignatureChecker.verifySignature(structHash, params.signatureA, params.signatureB, params.partyA, params.partyB),
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
    ) internal view returns (bool) {
        bytes32 hash = EIP712._hashTypedDataV4(structHash);
        address signerA = hash.recover(signatureA);
        address signerB = hash.recover(signatureB);
        return signerA == expectedSignerA && signerB == expectedSignerB;
    }
}

contract pSymm is EIP712 {

    struct CustodyRollup {
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        address settlementAddress;
        bytes32 MA;
        bool isManaged;
        uint8 state; // 0: open, 1: inSettlement, 2: settled
        uint256 timestamp;
        uint256 nonce;
    }


    mapping(bytes32 => CustodyRollup) private custodyRollups;
    mapping(bytes32 => mapping(address => uint256)) private custodyRollupBalances; // custodyRollupId => token address => balance
    mapping(bytes32 => bool) private signatureClaimed;
    

    constructor() EIP712("pSymm", "1") {}

    modifier checkAndClaimSignatures(bytes32 signatureA, bytes32 signatureB) {
        require(signatureClaimed[signatureA] == false && signatureClaimed[signatureB] == false, "Signature already claimed");
        signatureClaimed[signatureA] = true;
        signatureClaimed[signatureB] = true;
        _;
    }

    modifier checkExpiration(uint256 expiration) {
        require(block.timestamp < expiration, "Transaction expired");
        _;
    }

    modifier checkCustodialRollupOwner(address partyA, address partyB, uint256 _custodyRollupId) {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(partyA, partyB, _custodyRollupId));
        require(custodyRollups[custodyRollupId].state == 0, "Custodial rollup already closed");
        require(partyA != partyB, "Party A and Party B cannot be the same");
        require(custodyRollups[custodyRollupId].partyA == partyA && custodyRollups[custodyRollupId].partyB == partyB, "Invalid custodial rollup owner");
        _;
    }

    function _transferCustodyRollupBalance(
        bytes32 fromCustodyRollupId,
        bytes32 toCustodyRollupId,
        address collateralToken,
        uint256 amount
    ) private {
        require(custodyRollupBalances[fromCustodyRollupId][collateralToken] >= amount, "Insufficient balance");

        custodyRollupBalances[fromCustodyRollupId][collateralToken] -= amount;
        custodyRollupBalances[toCustodyRollupId][collateralToken] += amount;
    }

    // @notice Create a new CustodyRollup with EIP712 signature of counterparty
    function createCustodyRollup(createCustodyRollupParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyCreateCustodyRollup(params), "Invalid signature");

        bytes32 custodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));

        custodyRollups[custodyRollupId] = CustodyRollup(params.partyA, params.partyB, params.custodyRollupId, params.settlementAddress, params.MA, params.isManaged, 0);

        emit CustodyRollupCreated(params.custodyRollupId, params.partyA, params.partyB, params.settlementAddress);
    }

    function transferToCustodyRollup(transferToCustodyRollupParams memory params, uint256 _senderCustodyRollupId) 
        external 
        checkAndClaimSignatures(params.signSender, params.signReceiver) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyTransferToCustodyRollup(params), "Invalid signature");
        address sender = params.isA ? params.partyA : params.partyB;
        bytes32 custodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));
        bytes32 senderCustodyRollupId = keccak256(abi.encodePacked(sender, sender, _senderCustodyRollupId));

        _transferCustodyRollupBalance(senderCustodyRollupId, custodyRollupId, params.collateralToken, params.amount);

        emit TransferToCustodyRollup(custodyRollupId, params.collateralToken, params.amount, params.sender);
    }

    // @notice Withdraw from CustodyRollup, all withdraws requires EIP712 signature of counterparty    
    function transferFromCustodyRollup(transferFromCustodyRollupParams memory params, uint256 _receiverCustodyRollupId) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyTransferFromCustodyRollup(params), "Invalid signature");

        CustodyRollup storage custodyRollup = custodyRollups[params.custodyRollupId];
        address receiver = params.isA ? params.partyB : params.partyA;
        bytes32 receiverCustodyRollupId = keccak256(abi.encodePacked(receiver, receiver, _receiverCustodyRollupId));

        _transferCustodyRollupBalance(receiverCustodyRollupId, params.custodyRollupId, params.collateralToken, params.amount);

        emit WithdrawFromCustodyRollup(params.custodyRollupId, params.collateralToken, params.amount, receiver);
    }

    function updateMA(updateMAParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyUpdateMA(params), "Invalid signature");

       
        custodyRollups[params.custodyRollupId].MA = params.MA;

        emit MAUpdated(params.custodyRollupId, params.MA);
    }

    // @notice Open a settlement by calling the openSettlement function in pSymmSettlement contract
    function openSettlement(bytes32 custodyRollupId, bytes32 custodyRollupIdHash, address[] collateralTokens, uint256[] collateralAmounts) external {
        require(custodyRollups[custodyRollupId].state == 0, "Settlement already open");
        custodyRollups[custodyRollupId].state = 1;

        pSymmSettlement pSymmSettlementContract = pSymmSettlement(custodyRollups[custodyRollupId].settlementAddress);
    
        // Call openSettlement with necessary parameters
        pSymmSettlementContract.openSettlement(
            this.address, 
            custodyRollups[custodyRollupId].partyA, 
            custodyRollups[custodyRollupId].partyB, 
            custodyRollups[custodyRollupId].custodyRollupId,
            custodyRollups[custodyRollupId].MA, 
            custodyRollups[custodyRollupId].isManaged,
            custodyRollupIdHash
            );  

        custodyRollups[custodyRollupId].state = 1;

        emit SettlementOpened(custodyRollupId);
    }

    function deposit(address collateralToken, uint256 collateralAmount, uint256 _custodyRollupId) external {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(msg.sender, msg.sender, _custodyRollupId));
        // safe transfer from user
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);
        custodyRollupBalances[custodyRollupId][collateralToken] += collateralAmount;

        emit Deposit(collateralToken, collateralAmount);
    }

    function withdraw(address collateralToken, uint256 collateralAmount, uint256 _custodyRollupId) external {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(msg.sender, msg.sender, _custodyRollupId));
        // safe transfer to user
        IERC20(collateralToken).safeTransfer(msg.sender, collateralAmount);
        custodyRollupBalances[custodyRollupId][collateralToken] -= collateralAmount;

        emit Withdraw(collateralToken, collateralAmount);
    }

    // @notice Withdraw from settlement, only the settlement contract can call this function
    function settlementWithdraw(address collateralToken, uint256 collateralAmount, address partyA, address partyB, uint256 _custodyRollupId, bool isA) external {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(partyA, partyB, _custodyRollupId));
        bytes32 receiverCustodyRollupId = keccak256(abi.encodePacked(isA ? partyB : partyA, isA ? partyB : partyA, _custodyRollupId));
        require(custodyRollups[custodyRollupId].state == 2, "Settlement not settled");
        require(msg.sender == custodyRollups[custodyRollupId].settlementAddress, "Invalid Caller");

        _transferCustodyRollupBalance(custodyRollupId, receiverCustodyRollupId, collateralToken, collateralAmount);

        emit Withdraw(collateralToken, collateralAmount);
    }
}
