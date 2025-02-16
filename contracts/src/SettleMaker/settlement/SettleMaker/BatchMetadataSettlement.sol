// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../../../SettleMaker/Settlement.sol";
import "../../../SettleMaker/interfaces/IBatchMetadataSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Batch Metadata Settlement Contract
contract BatchMetadataSettlement is IBatchMetadataSettlement, Settlement {
    using SafeERC20 for IERC20;
    
    struct BatchMetadataParameters {
        uint256 settlementStart;
        uint256 votingStart; 
        uint256 votingEnd;
    }

    address private immutable deployer;

    bytes32 private constant BATCH_METADATA_TYPEHASH = 
        keccak256("BatchMetadataParameters(uint256 settlementStart,uint256 votingStart,uint256 votingEnd)");

    // Store metadata parameters per settlement
    mapping(bytes32 => BatchMetadataParameters) private batchMetadataParameters;

    constructor(
        string memory name,
        string memory version
    ) Settlement(address(0), name, version) {
		deployer = msg.sender;
	}

    function setSettleMaker(address _settleMaker) external {
        require(msg.sender == deployer, "Only deployer can set");
        require(settleMaker == address(0), "SettleMaker already set");
        require(_settleMaker != address(0), "Invalid SettleMaker address");
        
        settleMaker = _settleMaker;
    }

    function createBatchMetadataSettlement(
        uint256 settlementStart,
        uint256 votingStart,
        uint256 votingEnd
    ) external returns (bytes32) {
        require(votingEnd > votingStart, "Invalid voting end");
        require(
			votingStart > settlementStart &&
			votingStart > block.timestamp,
		"Invalid voting start");
        //require(settlementStart > block.timestamp, "Invalid settlement start");

        bytes32 settlementId = keccak256(abi.encode(
            settlementStart,
            votingStart,
            votingEnd
        ));

		// For BatchMetadataSettlement, validators should calculate settlementId manually instead of
		// listening to the settlement creation event, since the same batch metadata may already exist
		if (batchMetadataParameters[settlementId].votingEnd != 0) return settlementId;

		// Timestamps are already included
        // bytes32 settlementId = _createSettlementId(abi.encode(
        
        settlements[settlementId] = 0;

        BatchMetadataParameters memory params = BatchMetadataParameters({
            settlementStart: settlementStart,
            votingStart: votingStart,
            votingEnd: votingEnd
        });

        batchMetadataParameters[settlementId] = params;

        emit SettlementCreated(settlementId, msg.sender, address(this));
        
        return settlementId;
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public override(ISettlement, Settlement) {
        BatchMetadataParameters memory params = batchMetadataParameters[settlementId];
        
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        // Update SettleMaker's batch metadata
        ISettleMaker(settleMaker).updateBatchMetadata(params.settlementStart, params.votingStart, params.votingEnd);
        
    }

    function getBatchMetadataParameters(bytes32 settlementId) external view returns (
        uint256 settlementStart,
        uint256 votingStart,
        uint256 votingEnd
    ) {
        BatchMetadataParameters memory params = batchMetadataParameters[settlementId];
        return (params.settlementStart, params.votingStart, params.votingEnd);
    }

    function calculateBatchMetadataHash(BatchMetadataParameters memory params) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            BATCH_METADATA_TYPEHASH,
            params.settlementStart,
            params.votingStart,
            params.votingEnd
        ));
        return _hashTypedDataV4(structHash);
    }
}
