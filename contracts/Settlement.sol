// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interface/ISettlement.sol";
import "./interface/ISettleMaker.sol";
import "hardhat/console.sol";

abstract contract Settlement is ISettlement, EIP712 {
    mapping(bytes32 => SettlementState) internal settlements;
    address public settleMaker;

    constructor(address _settleMaker, string memory name, string memory version) 
        EIP712(name, version) 
    {
        if (_settleMaker != address(0)) {
            _setSettleMaker(_settleMaker);
        }
    }

    function _setSettleMaker(address _settleMaker) internal {
        require(settleMaker == address(0), "SettleMaker already set");
        require(_settleMaker != address(0), "Invalid SettleMaker address");
        settleMaker = _settleMaker;
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public virtual {
        require(settleMaker != address(0), "SettleMaker not set");
        console.log("Executing settlement in base contract:");
        console.log("Batch number:", batchNumber);
        console.log("Settlement ID:", uint256(settlementId));
        console.log("Merkle proof length:", merkleProof.length);
        
        // Verify merkle proof against SettleMaker's batchSoftFork
        bytes32 root = ISettleMaker(settleMaker).batchSoftFork(batchNumber);
        console.log("Retrieved root:", uint256(root));
        require(root != bytes32(0), "Invalid batch");
        
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(settlementId))));
        console.log("Calculated leaf:", uint256(leaf));
        require(
            MerkleProof.verify(merkleProof, root, leaf),
            "Invalid merkle proof"
        );

        require(settlements[settlementId] == SettlementState.Open, "Invalid state");
        settlements[settlementId] = SettlementState.Settled;
        
        emit SettlementExecuted(settlementId);
    }

    function getSettlementState(bytes32 settlementId) external view returns (SettlementState) {
        return settlements[settlementId];
    }

    function _createSettlementId(bytes memory encodedParams) internal view returns (bytes32) {
        return keccak256(abi.encode(
            encodedParams,
            block.timestamp,
            block.number
        ));
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getSymmToken() public view returns (address) {
        return ISettleMaker(settleMaker).symmToken();
    }
}
