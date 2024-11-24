// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/ISettlement.sol";
import "./interface/ISettleMaker.sol";
import "./interface/IEditSettlement.sol";
import "./interface/IValidatorSettlement.sol";
import "./interface/IBatchMetadataSettlement.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract SettleMaker is ISettleMaker, ReentrancyGuard {
    // State variables
    address public editSettlementAddress;
    address public immutable symmToken;
    BatchMetadata private _currentBatchMetadata;

    function currentBatchMetadata() external view returns (BatchMetadata memory) {
        return _currentBatchMetadata;
    }
    mapping(uint256 => bytes32) public batchSoftFork;
    mapping(uint256 => bytes32) public batchDataHashes;
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
        
        editSettlementAddress = _editSettlementAddress;
        symmToken = _symmToken;
        batchSoftFork[0] = initialMerkleRoot;
        currentBatch = 1;
    }

    // Get current state based on timestamps
    function getCurrentState() public view returns (uint8) {
        BatchMetadata memory metadata = _currentBatchMetadata;
        
        if (block.timestamp > metadata.votingEnd) return 3;
        if (block.timestamp > metadata.votingStart) return 2;
        if (block.timestamp > metadata.settlementStart) return 1;
        return 0;
    }

    // Allow edit settlement to update itself
    function setEditSettlement(address newEditSettlement) external {
        require(msg.sender == editSettlementAddress, "Only edit settlement");
        require(newEditSettlement != address(0), "Invalid address");
        
        editSettlementAddress = newEditSettlement;
        emit EditSettlementUpdated(newEditSettlement);
    }

    // Cast vote for a soft fork
    function castVote(bytes32 softForkRoot) external nonReentrant {
        //@ Vlad Maybe I did break something, by replacing enum not sure with number it should be for voting
        require(getCurrentState() == 2, "Invalid state");
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

    function submitSoftFork(
        bytes32 softForkRoot,
        bytes32 dataHash,
        bytes32 batchMetadataSettlementId,
        bytes32[] calldata merkleProof
    ) external {
        require(getCurrentState() == 2, "Invalid state");
        
        // Verify the batch metadata settlement is included in the soft fork
        bytes32 leaf = batchMetadataSettlementId;
        require(
            MerkleProof.verify(merkleProof, softForkRoot, leaf),
            "Invalid merkle proof"
        );

        // Get batch metadata parameters and verify timestamps
        address batchMetadataSettlement = IEditSettlement(editSettlementAddress)
            .batchMetadataSettlementAddress();
        
        (uint256 settlementStart, uint256 votingStart, uint256 votingEnd) = 
            IBatchMetadataSettlement(batchMetadataSettlement)
                .getBatchMetadataParameters(batchMetadataSettlementId);

        // Verify the new batch metadata has valid timestamps
        BatchMetadata memory currentMetadata = _currentBatchMetadata;
        require(settlementStart > currentMetadata.votingEnd, "Invalid settlement start");
        require(votingStart > settlementStart, "Invalid voting start");
        require(votingEnd > votingStart, "Invalid voting end");

        emit SoftForkSubmitted(softForkRoot, dataHash, msg.sender);
    }

    function finalizeBatchWinner() external nonReentrant {
        require(getCurrentState() == 3, "Invalid state");
        
        // Store winning root and its data hash
        bytes32 winningRoot = currentBatchWinner;
        batchSoftFork[currentBatch] = winningRoot;
        
        // Get data hash from the winning proposal
        // bytes32 dataHash = batchDataHashes[currentBatch];
        
        emit BatchFinalized(currentBatch, winningRoot);

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

