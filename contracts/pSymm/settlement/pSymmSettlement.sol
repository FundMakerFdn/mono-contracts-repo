// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "contracts/SettleMaker/Settlement.sol";
import "contracts/SettleMaker/interface/ISettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "contracts/pSymm/pSymm.sol";
import "contracts/pSymm/lib/EIP712SignatureChecker.sol";

abstract contract CollateralSettlement is Settlement, ICollateralSettlement {
    using SafeERC20 for IERC20;
    using ECDSA for bytes;
    using MessageHashUtils for bytes32;

    struct pSymmSettlementData {
        bytes32 custodyRollupId;
        bytes32 merkleRootA;
        uint256 submittedAtA;
        bytes32 merkleRootB;
        uint256 submittedAtB;
        address pSymmAddress;
        uint256 timestamp;
        uint8 state; // 0: Open, 1: Early Agreement, 2: Instant Withdraw // once a state is open, state is locked until all withdrawals are processed
        bytes32 nonce;
    }

    bytes32 private constant EARLY_AGREEMENT_TYPEHASH = 
        keccak256("EarlyAgreement(bytes32 settlementId,uint256 collateralAmount,address collateralToken,bytes32 custodyRollupId,uint256 expiration)");
    
    bytes32 private constant INSTANT_WITHDRAW_TYPEHASH = 
        keccak256("InstantWithdraw(bytes32 settlementId,address replacedParty,bool isA,uint256 instantWithdrawFee,address tokenAddress)");

    bytes32 private constant NONCE_TYPEHASH = 
        keccak256("Nonce(bytes32 settlementId,bytes32 nonce)");

    mapping(bytes32 => pSymmSettlementData) private pSymmSettlementDatas;

    constructor(
        address _settleMaker, 
        string memory name, 
        string memory version
    ) Settlement(_settleMaker, name, version) {}

    function createCollateralSettlement(
        bytes32 custodyRollupId,
        bytes32 merkleRoot,
        bool isA
    ) internal returns (bytes32) {
        bytes32 settlementId = keccak256(abi.encode(
            partyA,
            partyB,
            custodyRollupId,
            MA,
            isManaged,
            msg.sender,
            block.timestamp,
            block.number
        ));

        pSymmSettlement storage pSymmSettlement = settlements[settlementId];

        if (isA){
            pSymmSettlement.merkleRootA = merkleRootA;
            pSymmSettlement.submittedAtA = block.timestamp;
        } else {
            pSymmSettlement.merkleRootB = merkleRootB;
            pSymmSettlement.submittedAtB = block.timestamp;
        }

        pSymmSettlement.pSymmAddress = msg.sender;
        pSymmSettlement.custodyRollupId = custodyRollupId;

        emit CollateralSettlementCreated(settlementId, partyA, partyB, custodyRollupId, msg.sender);
        return settlementId;
    }

    function executeEarlyAgreement(
        bytes32 settlementId,
        uint256 collateralAmount,
        address collateralToken,
        bytes32 custodyRollupTarget,
        bytes32 custodyRollupReceiver,
        uint256 expiration,
        bytes32 nonce,
        bytes memory signature
    ) public virtual {
        pSymmSettlementData storage data = pSymmSettlementDatas[settlementId];
        if ( data.state == 0 ) {
            data.state = 1;
        } else {
            require( data.state == 1, "Early agreement already open" ); 
        }

        if ( data.nonce == 0 ) {
            // solvers sign all tx, and sign the nonce in the end
            bytes32 nonceHash = keccak256(abi.encode(
                NONCE_TYPEHASH,
                settlementId,
                nonce
            ));
            bytes32 nonceHashTyped =  _hashTypedDataV4(nonceHash);
            require( (EIP712SignatureChecker._verifySignature(nonceHashTyped, signature, data.partyA) && msg.sender == data.partyB) || (EIP712SignatureChecker._verifySignature(nonceHashTyped, signature, data.partyB) && msg.sender == data.partyA), "Invalid signature" );

            data.nonce = nonce;
        } else {
            require( data.nonce == nonce, "Nonce error" );
        }

        bytes32 structHash = keccak256(abi.encode(
            EARLY_AGREEMENT_TYPEHASH,
            settlementId,
            collateralAmount,
            collateralToken,
            custodyRollupTarget,
            custodyRollupReceiver,
            expiration,
            nonce
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        require( 
            (EIP712SignatureChecker._verifySignature(hash, signature, data.partyA) && msg.sender == data.partyB) ||
            (EIP712SignatureChecker._verifySignature(hash, signature, data.partyB) && msg.sender == data.partyA),
            "Invalid signature"
        );

        require(expiration > block.timestamp, "Early agreement expired");

        pSymm pSymmInstance = pSymm(data.pSymmAddress);
        pSymmInstance.executeEarlyAgreement(collateralToken, collateralAmount, custodyRollupTarget, custodyRollupReceiver, expiration);
        
        emit EarlyAgreementExecuted(settlementId, collateralAmount, collateralToken, custodyRollupId);
    }

    // @Vlad not sure about this integration
    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public virtual override(ISettlement, Settlement) {
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        CollateralData storage data = lockedCollateral[settlementId];
        _releaseCollateral(settlementId);
        
        emit SettlementExecuted(settlementId, data.collateralAmount, data.collateralAmount);
    }

    function executeInstantWithdraw(
        bytes32 settlementId,
        address replacedParty,
        uint256 instantWithdrawFee,
        bool isA,
        bytes memory signature
    ) external virtual {
        require(settlements[settlementId] == SettlementState.Open, "Settlement not open");
        CollateralData storage data = lockedCollateral[settlementId];

        bytes32 structHash = keccak256(abi.encode(
            INSTANT_WITHDRAW_TYPEHASH,
            settlementId,
            replacedParty,
            isA,
            instantWithdrawFee,
            data.pSymmAddress
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        require(EIP712SignatureChecker._verifySignature(hash, signature, replacedParty), "Invalid signature");


        pSymm pSymmInstance = pSymm(data.pSymmAddress);
        pSymmInstance.settlementWithdraw(data.custodyRollupId, msg.sender, replacedParty, isA);
        settlements[settlementId] = 2;
        emit InstantWithdrawExecuted(settlementId, data.custodyRollupId, data.pSymmAddress, msg.sender, replacedParty, instantWithdrawFee);
    }

    
}
