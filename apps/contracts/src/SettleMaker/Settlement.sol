// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interfaces/ISettlement.sol";
import "./interfaces/ISettleMaker.sol";

abstract contract Settlement is ISettlement, EIP712 {
    mapping(bytes32 => uint8) internal settlements;
    address public settleMaker;

    constructor(address _settleMaker, string memory name, string memory version) 
        EIP712(name, version) 
    {
        if (_settleMaker != address(0)) {
            settleMaker = _settleMaker;
        }
    }

    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public virtual {
        require(settleMaker != address(0), "SettleMaker not set");
        
        // Verify merkle proof against SettleMaker's batchSoftFork
        bytes32 root = ISettleMaker(settleMaker).batchSoftFork(batchNumber);
        require(root != bytes32(0), "Invalid batch");
        
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(settlementId))));
        require(
            MerkleProof.verify(merkleProof, root, leaf),
            "Invalid merkle proof"
        );

        require(settlements[settlementId] == 0, "Invalid state");
        settlements[settlementId] = 1;
        
        emit SettlementExecuted(settlementId);
    }

    function getSettlementState(bytes32 settlementId) external view returns (uint8) {
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
