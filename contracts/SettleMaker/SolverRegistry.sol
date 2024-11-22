// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title RFQ Registry Contract - Basic solver IP registry
abstract contract SolverRegistry {
    struct SolverData {
        string ipAddress;
        uint8 solverType;
    }
    
    event SolverRegistered(address indexed solver, string ipAddress);
    event SolverRemoved(address indexed solver);

    mapping(address => SolverData) public solvers;
    mapping(address => mapping( address => uint8)) kycTypes;
    
    /// @notice Register as a solver with IP address
    /// @param solverData The solver's data
    function registerSolver(SolverData memory solverData) external virtual{
        solvers[msg.sender] = solverData;
        emit SolverRegistered(msg.sender, solverData.ipAddress);
    }

    /// @notice Set KYC type for a solver
    /// @param kycProvider The KYC provider's address
    /// @param kycType The KYC type
    function setKycType(address kycProvider, uint8 kycType) external virtual{
        kycTypes[msg.sender][kycProvider] = kycType;
    }

    /// @notice Get solver's IP address
    function getSolver(address solver) external virtual view returns (string memory ipAddress, uint8 solverType){
        return (solvers[solver].ipAddress, solvers[solver].solverType);
    }

    /// @notice Get KYC type for a solver
    function getKycType(address solver, address kycProvider) external virtual view returns (uint8 kycType){
        return kycTypes[solver][kycProvider];
    }
}
