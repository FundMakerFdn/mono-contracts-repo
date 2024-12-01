// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./ISettlement.sol";

/// @title Unresolved List Settlement Interface
interface IUnresolvedListSettlement is ISettlement {
    event UnresolvedListUpdated(bytes32 newUnresolvedRoot, bytes32 dataHash);

    function currentUnresolvedRoot() external view returns (bytes32);
    function currentDataHash() external view returns (bytes32);
    
    function getUnresolvedListParameters(bytes32 settlementId) external view returns (
        bytes32 newUnresolvedRoot,
        bytes32 dataHash
    );
}
