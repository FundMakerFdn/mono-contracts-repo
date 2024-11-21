// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ISettlement.sol";
import "./interface/ISettleMaker.sol";

contract SettleMaker is ISettleMaker, ReentrancyGuard {
    // State variables
    address public editSettlementAddress;
    address public immutable symmToken;
    BatchMetadata private _currentBatchMetadata;

    function currentBatchMetadata() external view returns (BatchMetadata memory) {
        return _currentBatchMetadata;
    }
    mapping(uint256 => bytes32) public batchSoftFork;
    mapping(bytes32 => uint256) public votes;
    mapping(address => mapping(bytes32 => bool)) public hasVoted;
    bytes32 public currentBatchWinner;
    uint256 public currentBatch;


    constructor(
        address _editSettlementAddress,
        address _symmToken,
        bytes32 initialMerkleRoot
    ) {
        require(_editSettlementAddress != address(0), "Invalid edit settlement");
        require(_symmToken != address(0), "Invalid SYMM token");
        require(
            IERC165(_editSettlementAddress).supportsInterface(type(ISettlement).interfaceId),
            "Must implement ISettlement"
        );
        require(IERC20(_symmToken).totalSupply() > 0, "Invalid ERC20 token");
        
        editSettlementAddress = _editSettlementAddress;
        symmToken = _symmToken;
        batchSoftFork[0] = initialMerkleRoot;
        currentBatch = 1;
    }

    // Get current state based on timestamps
    function getCurrentState() public view returns (StateEnum) {
        BatchMetadata memory metadata = _currentBatchMetadata;
        
        if (block.timestamp > metadata.votingEnd) return StateEnum.VOTING_END;
        if (block.timestamp > metadata.votingStart) return StateEnum.VOTING;
        if (block.timestamp > metadata.settlementStart) return StateEnum.SETTLEMENT;
        return StateEnum.PAUSE;
    }

    // Allow edit settlement to update itself
    function setEditSettlement(address newEditSettlement) external {
        require(msg.sender == editSettlementAddress, "Only edit settlement");
        require(newEditSettlement != address(0), "Invalid address");
        require(
            IERC165(newEditSettlement).supportsInterface(type(ISettlement).interfaceId),
            "Must implement ISettlement"
        );
        
        editSettlementAddress = newEditSettlement;
        emit EditSettlementUpdated(newEditSettlement);
    }

    // Cast vote for a soft fork
    function castVote(bytes32 softForkRoot) external nonReentrant {
        require(getCurrentState() == StateEnum.VOTING, "Invalid state");
        require(isValidator(msg.sender), "Not a validator");
        require(!hasVoted[msg.sender][softForkRoot], "Already voted");

        hasVoted[msg.sender][softForkRoot] = true;
        votes[softForkRoot]++;

        // Update current winner if this fork has more votes
        if (votes[softForkRoot] > votes[currentBatchWinner]) {
            currentBatchWinner = softForkRoot;
        }

        emit VoteCast(msg.sender, softForkRoot);
    }

    // Finalize the current batch
    function updateBatchMetadata(
        uint256 settlementStart,
        uint256 votingStart,
        uint256 votingEnd
    ) external {
        // Only allow batch metadata settlement to update
        address batchMetadataSettlement = IEditSettlement(editSettlementAddress)
            .batchMetadataSettlementAddress();
        require(msg.sender == batchMetadataSettlement, "Only batch metadata settlement");
        
        _currentBatchMetadata = BatchMetadata({
            settlementStart: settlementStart,
            votingStart: votingStart,
            votingEnd: votingEnd
        });
    }

    function finalizeBatchWinner() external nonReentrant {
        require(getCurrentState() == StateEnum.VOTING_END, "Invalid state");
        
        // Store winning root
        batchSoftFork[currentBatch] = currentBatchWinner;
        
        emit BatchFinalized(currentBatch, currentBatchWinner);

        // Reset state for next batch
        delete currentBatchWinner;
        currentBatch++;
    }

    // Helper to check if address is validator
    function isValidator(address account) public view returns (bool) {
        // Get validator settlement from edit settlement and verify
        address validatorSettlement = IEditSettlement(editSettlementAddress)
            .validatorSettlementAddress();
        return IValidatorSettlement(validatorSettlement).verifyValidator(account);
    }
}

// Interfaces needed
interface IEditSettlement is ISettlement {
    function validatorSettlementAddress() external view returns (address);
    function batchMetadataSettlementAddress() external view returns (address);
}

interface IValidatorSettlement is ISettlement {
    function verifyValidator(address account) external view returns (bool);
}
