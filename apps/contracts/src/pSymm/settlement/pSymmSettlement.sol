// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../../SettleMaker/Settlement.sol";
import "../../SettleMaker/interface/ISettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../../pSymm/lib/EIP712SignatureChecker.sol";
import "../../pSymm/pSymm.sol" as pSymm;

contract pSymmSettlement is Settlement {
    using SafeERC20 for IERC20;
    using ECDSA for bytes;
    using MessageHashUtils for bytes32;

    struct pSymmSettlementData {
        address partyA;
        address partyB;
        bytes32 custodyId;
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
        keccak256("EarlyAgreement(bytes32 settlementId,uint256 collateralAmount,address collateralToken,bytes32 custodyId,uint256 expiration)");
    
    bytes32 private constant INSTANT_WITHDRAW_TYPEHASH = 
        keccak256("InstantWithdraw(bytes32 settlementId,address replacedParty,bool isA,uint256 instantWithdrawFee,address instantWithdrawToken)");

    bytes32 private constant NONCE_TYPEHASH = 
        keccak256("Nonce(bytes32 settlementId,bytes32 nonce)");

    event EarlyAgreementExecuted(bytes32 indexed settlementId, uint256 collateralAmount, address collateralToken, bytes32 custodyId);
    event InstantWithdrawExecuted(bytes32 indexed settlementId, bytes32 custodyId, address pSymmAddress, address partyA, address replacedParty, uint256 instantWithdrawFee);
    event CollateralSettlementCreated(bytes32 indexed settlementId, address partyA, bytes32 merkleRoot, bytes32 custodyId, bool isA);

    mapping(bytes32 => pSymmSettlementData) private pSymmSettlementDatas;
    mapping(bytes32 => bytes32) public pSymmDataHashes;

    constructor(
        address _settleMaker, 
        string memory name, 
        string memory version
    ) Settlement(_settleMaker, name, version) {}

    function openSettlement(
        address partyA,
        address partyB,
        bytes32 custodyId,
        bytes32 merkleRoot,
        bytes32 dataHash,
        bool isA
    ) external returns (bytes32) {
        bytes32 settlementId = keccak256(abi.encode(
            custodyId,
            merkleRoot,
            isA,
            msg.sender,
            block.timestamp,
            block.number
        ));
        require( pSymmSettlementDatas[settlementId].state == 0, "Settlement already open" );

        pSymmSettlementData storage settlementData = pSymmSettlementDatas[settlementId];

        if (isA){
            settlementData.merkleRootA = merkleRoot;
            settlementData.submittedAtA = block.timestamp;
        } else {
            settlementData.merkleRootB = merkleRoot;
            settlementData.submittedAtB = block.timestamp;
        }

        settlementData.pSymmAddress = msg.sender;
        settlementData.custodyId = custodyId;
        settlementData.partyA = partyA;
        settlementData.partyB = partyB;

        pSymmDataHashes[settlementId] = dataHash;

        emit CollateralSettlementCreated(settlementId, msg.sender, merkleRoot, custodyId, isA);
        return settlementId;
    }
    
	function answerSettlement(
		bytes32 settlementId,
		bytes32 merkleRoot
	) external {
		pSymmSettlementData storage settlementData = pSymmSettlementDatas[settlementId];
		require(settlementData.state == 0, "Settlement is not in an open state.");

		if(settlementData.submittedAtA == 0 && msg.sender == settlementData.partyA){
			settlementData.submittedAtA = block.timestamp;
			settlementData.merkleRootA = merkleRoot;
		} else if(settlementData.submittedAtB == 0 && msg.sender == settlementData.partyB) {
			settlementData.submittedAtB = block.timestamp;
			settlementData.merkleRootB = merkleRoot;
		} else {
			revert("Settlement has already been answered by this party.");
		}
	}


    function executeEarlyAgreement(
        bytes32 settlementId,
        bytes32 custodyTarget,
        bytes32 custodyReceiver,
        address collateralToken,
        uint256 collateralAmount,
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
            custodyTarget,
            custodyReceiver,
            collateralToken,
            collateralAmount,
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

        pSymm.pSymm pSymmInstance = pSymm.pSymm(data.pSymmAddress);
        pSymmInstance.settlementWithdraw(collateralToken, collateralAmount, custodyTarget, custodyReceiver);
        
        emit EarlyAgreementExecuted(settlementId, collateralAmount, collateralToken, data.custodyId);
    }

    // @Vlad not sure about this integration
    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public virtual override( Settlement) {
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        // @Vlad
        /*
        for each token in the settlement, if 50/50 distribution, 2 settlement happens in the merkle
        collateralToken, collateralAmount, custodyTarget, custodyReceiver
        */
        
        emit SettlementExecuted(settlementId);
    }

    function executeInstantWithdraw(
        bytes32 settlementId,
        address replacedParty,
        uint256 instantWithdrawFee,
        address instantWithdrawToken,
        bool isA,
        bytes memory signature
    ) external virtual {
        require(pSymmSettlementDatas[settlementId].state == 0, "Settlement not open");
        pSymmSettlementData storage data = pSymmSettlementDatas[settlementId];

        bytes32 structHash = keccak256(abi.encode(
            INSTANT_WITHDRAW_TYPEHASH,
            settlementId,
            replacedParty,
            isA,
            instantWithdrawFee,
            instantWithdrawToken,
            data.pSymmAddress
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        require(EIP712SignatureChecker._verifySignature(hash, signature, replacedParty), "Invalid signature");

        
        IERC20(instantWithdrawToken).safeTransferFrom(msg.sender, replacedParty, instantWithdrawFee);

        pSymm.pSymm pSymmInstance = pSymm.pSymm(data.pSymmAddress);
        pSymmInstance.settlementWithdraw(data.custodyId, msg.sender, replacedParty, isA);
        data.state = 2;
        emit InstantWithdrawExecuted(settlementId, data.custodyId, data.pSymmAddress, msg.sender, replacedParty, instantWithdrawFee);
    }


    // read functions
    function getSettlementData(bytes32 settlementId) external view returns (pSymmSettlementData memory) {
        return pSymmSettlementDatas[settlementId];
    }

}
