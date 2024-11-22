// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RFQ Registry Contract - Basic solver IP registry
abstract contract RegistryRFQ {
    struct SolverData {
        string ipAddress;
    }
    
    event SolverRegistered(address indexed solver, string ipAddress);
    event SolverRemoved(address indexed solver);
    
    /// @notice Register as a solver with IP address
    /// @param ipAddress The solver's IP address for RFQ communication
    function registerSolver(string calldata ipAddress) external virtual;
    
    /// @notice Remove solver from registry
    function removeSolver() external virtual;

    /// @notice Get solver's IP address
    function getSolver(address solver) external virtual view returns (string memory ipAddress);
}
