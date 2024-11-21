// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "contracts/Settlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Batch Metadata Settlement Contract
contract BatchMetadataSettlement is Settlement {
    using SafeERC20 for IERC20;
    
    struct BatchMetadataParameters {
        uint256 settlementStart;
        uint256 votingStart; 
        uint256 votingEnd;
    }

    bytes32 private constant BATCH_METADATA_TYPEHASH = 
        keccak256("BatchMetadataParameters(uint256 settlementStart,uint256 votingStart,uint256 votingEnd)");

    // Store metadata parameters per settlement
    mapping(bytes32 => BatchMetadataParameters) private batchMetadataParameters;

    constructor(
        address _settleMaker,
        string memory name,
        string memory version
    ) Settlement(_settleMaker, name, version) {}

    function createBatchMetadataSettlement(
        uint256 settlementStart,
        uint256 votingStart,
        uint256 votingEnd
    ) external returns (bytes32) {
        require(votingEnd > votingStart, "Invalid voting end");
        require(votingStart > settlementStart, "Invalid voting start");
        require(settlementStart > block.timestamp, "Invalid settlement start");

        bytes32 settlementId = keccak256(abi.encode(
            settlementStart,
            votingStart,
            votingEnd,
            block.timestamp,
            block.number
        ));
        
        settlements[settlementId] = SettlementState.Open;

        BatchMetadataParameters memory params = BatchMetadataParameters({
            settlementStart: settlementStart,
            votingStart: votingStart,
            votingEnd: votingEnd
        });

        batchMetadataParameters[settlementId] = params;
        
        return settlementId;
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public override returns (bool) {
        bool success = super.executeSettlement(batchNumber, settlementId, merkleProof);
        require(success, "Settlement execution failed");

        BatchMetadataParameters memory params = batchMetadataParameters[settlementId];
        
        // Update SettleMaker's batch metadata
        ISettleMaker(settleMaker).updateBatchMetadata(params.settlementStart, params.votingStart, params.votingEnd);

        return true;
    }

    function getBatchMetadataParameters(bytes32 settlementId) external view returns (BatchMetadataParameters memory) {
        return batchMetadataParameters[settlementId];
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
