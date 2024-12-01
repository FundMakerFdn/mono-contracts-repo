// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "contracts/SettleMaker/Settlement.sol";
import "contracts/SettleMaker/interface/IUnresolvedListSettlement.sol";

/// @title Unresolved List Settlement Contract
contract UnresolvedListSettlement is IUnresolvedListSettlement, Settlement {
    
    struct UnresolvedListParameters {
        bytes32 newUnresolvedRoot;
        bytes32 dataHash;
    }

    bytes32 private constant UNRESOLVED_LIST_TYPEHASH = 
        keccak256("UnresolvedListParameters(bytes32 newUnresolvedRoot,bytes32 dataHash)");

    // Store unresolved list parameters per settlement
    mapping(bytes32 => UnresolvedListParameters) private unresolvedListParameters;
    
    // Current unresolved merkle root and its data hash
    bytes32 public currentUnresolvedRoot;
    bytes32 public currentDataHash;

    constructor(
        address _settleMaker,
        string memory name,
        string memory version
    ) Settlement(_settleMaker, name, version) {}

    function createUnresolvedListSettlement(
        bytes32 newUnresolvedRoot,
        bytes32 dataHash
    ) external returns (bytes32) {
        bytes32 settlementId = _createSettlementId(abi.encode(
            newUnresolvedRoot,
            dataHash
        ));
        
        settlements[settlementId] = 0;

        UnresolvedListParameters memory params = UnresolvedListParameters({
            newUnresolvedRoot: newUnresolvedRoot,
            dataHash: dataHash
        });

        unresolvedListParameters[settlementId] = params;
        
        emit SettlementCreated(settlementId, msg.sender, address(this));
        
        return settlementId;
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public override(ISettlement, Settlement) {
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        UnresolvedListParameters memory params = unresolvedListParameters[settlementId];
        
        // Update current unresolved list root and data hash
        currentUnresolvedRoot = params.newUnresolvedRoot;
        currentDataHash = params.dataHash;

        emit UnresolvedListUpdated(params.newUnresolvedRoot, params.dataHash);
    }

    function getUnresolvedListParameters(bytes32 settlementId) external view returns (
        bytes32 newUnresolvedRoot,
        bytes32 dataHash
    ) {
        UnresolvedListParameters memory params = unresolvedListParameters[settlementId];
        return (params.newUnresolvedRoot, params.dataHash);
    }

    function calculateUnresolvedListHash(UnresolvedListParameters memory params) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            UNRESOLVED_LIST_TYPEHASH,
            params.newUnresolvedRoot,
            params.dataHash
        ));
        return _hashTypedDataV4(structHash);
    }
}
