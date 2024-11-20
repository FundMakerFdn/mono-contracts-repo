// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interface/ISettlement.sol";
import "./interface/ISettleMaker.sol";

abstract contract Settlement is ISettlement, EIP712 {
    mapping(bytes32 => SettlementState) internal settlements;
    address public immutable settleMaker;

    constructor(address _settleMaker, string memory name, string memory version) 
        EIP712(name, version) 
    {
        settleMaker = _settleMaker;
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public virtual returns (bool) {
        // Verify merkle proof against SettleMaker's batchSoftFork
        bytes32 root = ISettleMaker(settleMaker).batchSoftFork(batchNumber);
        require(root != bytes32(0), "Invalid batch");
        
        bytes32 leaf = keccak256(abi.encode(settlementId));
        require(
            MerkleProof.verify(merkleProof, root, leaf),
            "Invalid merkle proof"
        );

        require(settlements[settlementId] == SettlementState.Open, "Invalid state");
        settlements[settlementId] = SettlementState.Settled;
        
        emit SettlementExecuted(settlementId);
        return true;
    }

    function getSettlementState(bytes32 settlementId) external view returns (SettlementState) {
        return settlements[settlementId];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getSymmToken() public view returns (address) {
        return ISettleMaker(settleMaker).symmToken();
    }
}
