// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "contracts/SettleMaker/Settlement.sol";
import "contracts/SettleMaker/interface/IEditSettlement.sol";

/// @title Edit Settlement Contract
/// @notice Manages core settlement contract addresses through voting
contract EditSettlement is IEditSettlement, Settlement {
    // Core settlement addresses
    address public validatorSettlementAddress;
    address public batchMetadataSettlementAddress;
    address private immutable deployer;


    // Edit settlement parameters
    struct EditParameters {
        address newSettlementAddress;
        SettlementType settlementType;
    }

    enum SettlementType {
        VALIDATOR,
        BATCH_METADATA,
        EDIT_SETTLEMENT
    }

    bytes32 private constant EDIT_SETTLEMENT_TYPEHASH = 
        keccak256("EditSettlement(address newSettlementAddress,uint8 settlementType)");

    // Store parameters per settlement
    mapping(bytes32 => EditParameters) private editParameters;

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

    function createEditSettlement(
        address newSettlementAddress,
        SettlementType settlementType
    ) external returns (bytes32) {

        bytes32 settlementId = _createSettlementId(abi.encode(
            newSettlementAddress,
            settlementType
        ));
        
        settlements[settlementId] = SettlementState.Open;

        editParameters[settlementId] = EditParameters({
            newSettlementAddress: newSettlementAddress,
            settlementType: settlementType
        });

        emit SettlementCreated(settlementId, msg.sender, address(this));

        return settlementId;
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId, 
        bytes32[] calldata merkleProof
    ) public override(ISettlement, Settlement) {
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        EditParameters memory params = editParameters[settlementId];

        // Update appropriate address based on settlement type
        if (params.settlementType == SettlementType.VALIDATOR) {
            validatorSettlementAddress = params.newSettlementAddress;
        } else if (params.settlementType == SettlementType.BATCH_METADATA) {
            batchMetadataSettlementAddress = params.newSettlementAddress;
        } else if (params.settlementType == SettlementType.EDIT_SETTLEMENT) {
            // Special case - update SettleMaker's editSettlementAddress
            if (params.newSettlementAddress != address(this)) {
                ISettleMaker(settleMaker).setEditSettlement(params.newSettlementAddress);
            }
        }
    }

    function getEditParameters(bytes32 settlementId) external view returns (EditParameters memory) {
        return editParameters[settlementId];
    }

    function calculateEditHash(EditParameters memory params) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            EDIT_SETTLEMENT_TYPEHASH,
            params.newSettlementAddress,
            params.settlementType
        ));
        return _hashTypedDataV4(structHash);
    }
}
