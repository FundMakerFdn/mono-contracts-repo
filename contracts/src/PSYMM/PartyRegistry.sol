// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./Schnorr.sol";

/// @title IP Registry Contract & KYC Provider Registry
contract PartyRegistry {
    struct PartyData {
        string role;
        string ipAddress;
        Schnorr.PPMKey pubKey;
    }

    event PartyRegistered(string role, address indexed party, string ipAddress, Schnorr.PPMKey pubKey);
    event PartyRemoved(address indexed party);
    event ReputationSet(address indexed party, address indexed kycProvider, uint256 score);

    mapping(address => PartyData) public partys;
    mapping(address => mapping(address => uint256)) public reputation;
    mapping(address => mapping(address => uint8)) public kycTypes;
    
    /// @notice Register as a party with IP address and public key
    /// @param partyData The party's data including Schnorr public key
    function registerParty(PartyData memory partyData) external {
        partys[msg.sender] = partyData;
        emit PartyRegistered(partyData.role, msg.sender, partyData.ipAddress, partyData.pubKey);
    }

    /// @notice Set KYC type for a party
    /// @param kycProvider The KYC provider's address
    /// @param kycType The KYC type
    function setKycType(address kycProvider, uint8 kycType) external {
        kycTypes[msg.sender][kycProvider] = kycType;
    }

    /// @notice Set reputation for a party ( See it as an Amazon review rating)
    /// @param kycProvider The KYC provider's address
    /// @param score The reputation score
    function setReputation(address kycProvider, uint256 score) external {
        reputation[msg.sender][kycProvider] = score;
        emit ReputationSet(msg.sender, kycProvider, score);
    }

    /// @notice Get party's IP address
    function getParty(address party) external view returns (string memory ipAddress){
        return partys[party].ipAddress;
    }

    /// @notice Get KYC type for a party
    function getKycType(address party, address kycProvider) external view returns (uint8 kycType){
        return kycTypes[party][kycProvider];
    }

    function getReputation(address party, address kycProvider) external view returns (uint256 score){
        return reputation[party][kycProvider];
    }
}
