// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title IP Registry Contract & KYC Provider Registry
contract SolverRegistry {
    struct SolverData {
        string ipAddress;
        uint8 solverType;
    }

    event SolverRegistered(address indexed solver, string ipAddress);
    event SolverRemoved(address indexed solver);
    event ReputationSet(address indexed solver, address indexed kycProvider, uint256 score);

    mapping(address => SolverData) public solvers;
    mapping(address => mapping( address => uint256)) public reputation;
    mapping(address => mapping( address => uint8)) public kycTypes;
    
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

    /// @notice Set reputation for a solver ( See it as an Amazon review rating)
    /// @param kycProvider The KYC provider's address
    /// @param score The reputation score
    function setReputation(address kycProvider, uint256 score) external virtual{
        reputation[msg.sender][kycProvider] = score;
        emit ReputationSet(msg.sender, kycProvider, score);
    }

    /// @notice Get solver's IP address
    function getSolver(address solver) external virtual view returns (string memory ipAddress, uint8 solverType){
        return (solvers[solver].ipAddress, solvers[solver].solverType);
    }

    /// @notice Get KYC type for a solver
    function getKycType(address solver, address kycProvider) external virtual view returns (uint8 kycType){
        return kycTypes[solver][kycProvider];
    }

    function getReputation(address solver, address kycProvider) external virtual view returns (uint256 score){
        return reputation[solver][kycProvider];
    }
}
