// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {UltraVerifier as VerifierCTC} from "./VerifierCTC.sol";
import {UltraVerifier as VerifierATC} from "./VerifierATC.sol";

using SafeERC20 for IERC20;

contract noirPsymm {
    // --- Events ---
    event Deposit(bytes32 indexed commitment, uint32 index, uint256 timestamp, uint256 amount, address token, address sender);
    event CustodyStateChanged(bytes32 indexed id, uint8 newState);
    event SMADeployed(bytes32 indexed id, address factoryAddress, address smaAddress);

    // --- Merkle Tree Parameters ---
    // TREE_LEVELS is set to 10, which gives us 2^10 leaves.
    uint256 public constant TREE_LEVELS = 10;
    uint256 public constant MAX_LEAVES = 2 ** TREE_LEVELS;
    
    // The current Merkle root of the tree.
    bytes32 public MERKLE_ROOT;
    // Next free leaf index.
    uint32 public nextIndex;
    // Precomputed zero (empty node) values for each level.
    bytes32[TREE_LEVELS] public zeros;
    // Stores the latest left node at each level for updating the tree.
    bytes32[TREE_LEVELS] public filledSubtrees;
    // Mapping from leaf index to the commitment stored there.
    mapping(uint256 => bytes32) public leaves;

    // --- Additional Mappings and State Variables ---
    mapping(bytes32 => bool) private commitments;
    mapping(bytes32 => bool) private nullifier;
    mapping(bytes32 => uint8) private custodyState;
    mapping(bytes32 => mapping(uint256 => bytes)) public custodyMsg;
    mapping(bytes32 => uint256) private custodyMsgLength;
    
    // Mapping for custody balances (for custody-to-address transfers)
    mapping(bytes32 => mapping(address => uint256)) public seizedBalances; // _id -> _token -> _amount
    // Mapping of custody id to PPM 
    mapping(bytes32 => bytes32) public PPMs;

    VerifierATC public verifierATC;
    VerifierCTC public verifierCTC;

    // --- Constructor ---
    // Precompute the zero hashes for each level.
    constructor(address _vATC, address _vCTC) {
        verifierATC = VerifierATC(_vATC);
        verifierCTC = VerifierCTC(_vCTC);
        uint256 currentZero = 0;
        for (uint256 i = 0; i < TREE_LEVELS; i++) {
            zeros[i] = bytes32(currentZero);
            currentZero = uint256(keccak256(abi.encodePacked(currentZero, currentZero)));
        }
        MERKLE_ROOT = zeros[TREE_LEVELS - 1];
    }

    /// @notice Inserts a new commitment into the Merkle tree.
    /// @dev Updates the tree upward while preserving all previously inserted data.
    /// @param _commitment The commitment (leaf) to insert.
    /// @return index The index at which the commitment was inserted.
    function _insert(bytes32 _commitment) internal returns (uint32 index) {
        index = nextIndex;
        require(index < MAX_LEAVES, "Merkle tree is full");
        
        // Store the commitment in the leaves mapping.
        leaves[index] = _commitment;
        nextIndex++;

        // Compute the new root by hashing upward from the new leaf.
        bytes32 currentHash = _commitment;
        uint32 currentIndex = index;
        for (uint256 level = 0; level < TREE_LEVELS; level++) {
            if (currentIndex % 2 == 0) {
                // Record the filled subtree at this level.
                filledSubtrees[level] = currentHash;
                // Hash with the default zero for the missing right child.
                currentHash = _hash(currentHash, zeros[level]);
            } else {
                // If the current node is a right child, combine with its left sibling.
                currentHash = _hash(filledSubtrees[level], currentHash);
            }
            currentIndex /= 2;
        }
        
        // Update the global Merkle root.
        MERKLE_ROOT = currentHash;
        return index;
    }

    /// @notice Helper function to compute the hash of two nodes.
    /// @param left The left node.
    /// @param right The right node.
    /// @return The resulting hash.
    function _hash(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }

    /// @notice Helper function to mimic the behavior of ECDSA.toEthSignedMessageHash.
    /// @param hash The hash to convert.
    /// @return The Ethereum signed message hash.
    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        // 32 is the length in bytes of hash.
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    modifier checkCustodyState(bytes32 _id, uint8 _state) {
        require(custodyState[_id] == _state, "State isn't 0");
        _;
    }

    modifier checkNullifier(bytes32 _nullifier) {
        require(!nullifier[_nullifier], "Nullifier has been used");
        _;
    }
    
    modifier checkExpiry(uint256 _timestamp) {
        require(_timestamp <= block.timestamp, "Signature expired");
        _;
    }

    /// @notice Moves an address-based deposit into custody.
    /// @param _commitment The commitment associated with the deposit.
    function addressToCustody(bytes calldata _zkProof, bytes32 _commitment, uint256 _amount, address _token) public {
        require(!commitments[_commitment], "The commitment has been submitted");

        bytes32[] memory inputs = new bytes32[](96); // 32 bytes * 3 parameters
        
        bytes32[] memory amountBytes = chopBytes32(bytes32(_amount));
        bytes32[] memory tokenBytes = chopBytes32(bytes32(bytes20(uint160(_token))));
        bytes32[] memory commitmentBytes = chopBytes32(_commitment);
        
        for(uint i = 0; i < 32; i++) {
            inputs[i] = amountBytes[i];
            inputs[i + 32] = tokenBytes[i];
            inputs[i + 64] = commitmentBytes[i];
        }

        require(verifierCTC.verify(_zkProof, inputs), "ZK proof failed");

        uint32 insertedIndex = _insert(_commitment);
        commitments[_commitment] = true;

        // deposit erc20
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposit(_commitment, insertedIndex, block.timestamp, _amount, _token, msg.sender);
    }

    /// @notice Transfers funds from custody to an external address.
    /// @param _id The custody identifier.
    /// @param _token The token address.
    /// @param _destination The destination address.
    /// @param _amount The amount to transfer.
    /// @param _timestamp The timestamp for the signature.
    /// @param _signer The signer address that is whitelisted.
    /// @param _signature The ECDSA signature.
    /// @param _merkleProof The Merkle proof for whitelisting.
    /// @param _commitment Partial withdrawal commitment.
    /// @param _nullifier The nullifier associated with the deposit.
    function custodyToAddress(
        bytes32 _id,
        address _token,
        address _destination,
        uint256 _amount,
        uint256 _timestamp,
        address _signer,
        bytes calldata _signature,
        bytes32[] calldata _merkleProof,
        bytes32 _nullifier,
        bytes32 _commitment
    ) external checkCustodyState(_id, 0) checkExpiry(_timestamp) checkNullifier(_nullifier) {
        nullifier[_nullifier] = true;
        // Verify the signer is whitelisted via Merkle proof.
        bytes32 leaf = keccak256(abi.encode(
            "custodyToAddress",
            block.chainid,
            address(this),
            custodyState[_id],
            _signer
        ));
        require(MerkleProof.verify(_merkleProof, _getPPM(_id), leaf), "Invalid merkle proof");

        // Verify signature using ECDSA.
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "custodyToAddress",
            _id,
            _token,
            _destination,
            _amount,
            _commitment,
            _nullifier
        ));
        bytes32 ethSignedMessageHash = _toEthSignedMessageHash(message);
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, _signature);
        require(recoveredSigner == _signer, "Invalid signature");

        IERC20(_token).safeTransfer(_destination, _amount);

        addressToCustody(_commitment, 0, address(0));

        /*Verify(bytes calldata _zkProof,
            bytes32 _nullifier,
            bytes32 _id)
        */
    }

    /// @notice Transfers custody from one account to another within the system.
    /// @param _id The custody identifier.
    /// @param _timestamp The timestamp for the signature.
    /// @param _signer The signer address that is whitelisted.
    /// @param _signature The ECDSA signature.
    /// @param _merkleProof The Merkle proof for whitelisting.
    /// @param _nullifier The nullifier (hash) associated with the deposit.
    /// @param _commitment1 commitment 1.
    /// @param _commitment2 commitment 2.
    function custodyToCustody(
		bytes calldata _zkProof,
        bytes32 _id,
        uint256 _timestamp,
        address _signer,
        bytes calldata _signature,
        bytes32[] calldata _merkleProof,
        bytes32 _nullifier,
        bytes32 _commitment1,
        bytes32 _commitment2
    ) external checkCustodyState(_id, 0) checkExpiry(_timestamp) checkNullifier(_nullifier) {
        nullifier[_nullifier] = true;
        bytes32 leaf = keccak256(abi.encode(
            "custodyToCustody",
            block.chainid,
            address(this),
            custodyState[_id],
            _signer
        ));
        require(MerkleProof.verify(_merkleProof, _getPPM(_id), leaf), "Invalid merkle proof");

        // Verify signature using ECDSA.
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "custodyToCustody",
            _id,
            _commitment1,
            _commitment2,
            _nullifier
        ));
        bytes32 ethSignedMessageHash = _toEthSignedMessageHash(message);
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, _signature);
        require(recoveredSigner == _signer, "Invalid signature");

        bytes32[] memory inputs = new bytes32[](96); // 32 bytes * 3 parameters
        
        bytes32[] memory nullifierBytes = chopBytes32(_nullifier);
        bytes32[] memory rootBytes = chopBytes32(MERKLE_ROOT);
        bytes32[] memory idBytes = chopBytes32(_id);
        
        for(uint i = 0; i < 32; i++) {
            inputs[i] = nullifierBytes[i];
            inputs[i + 32] = rootBytes[i];
            inputs[i + 64] = idBytes[i];
        }
        
        require(verifierCTC.verify(_zkProof, inputs), "ZK proof failed");

        addressToCustody(_commitment1, 0, address(0));
        addressToCustody(_commitment2, 0, address(0));

    }

    /// @notice Splits a bytes32 into an array of 32 bytes32, each containing a single byte padded with zeros
    /// @param _input The bytes32 to split
    /// @return result Array of 32 bytes32, each containing a single byte from the input
    function chopBytes32(bytes32 _input) internal pure returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](32);
        
        for (uint i = 0; i < 32; i++) {
            // Shift right by (31-i)*8 bits to get the desired byte to the rightmost position
            // Then mask with 0xff to keep only that byte
            uint8 byteVal = uint8(uint256(_input) >> ((31-i) * 8) & 0xff);
            result[i] = bytes32(uint256(byteVal));
        }
        
        return result;
    }

    /// @notice Changes the custody state.
    /// @param _id The custody identifier.
    /// @param _state The new state.
    /// @param _timestamp The timestamp for the signature.
    /// @param _signer The signer address that is whitelisted.
    /// @param _signature The ECDSA signature.
    /// @param _merkleProof The Merkle proof for whitelisting.
    function changeCustodyState(
        bytes32 _id,
        uint8 _state,
        uint256 _timestamp,
        address _signer,
        bytes calldata _signature,
        bytes32[] calldata _merkleProof
    ) external checkExpiry(_timestamp) {

        // Verify the signer is whitelisted via Merkle proof.
        bytes32 leaf = keccak256(abi.encode(
            "changeCustodyState",
            block.chainid,
            address(this),
            custodyState[_id],
            _state,
            _signer
        ));
        require(MerkleProof.verify(_merkleProof, _getPPM(_id), leaf), "Invalid merkle proof");

        // Verify signature using ECDSA.
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "changeCustodyState",
            _id,
            _state
        ));
        bytes32 ethSignedMessageHash = _toEthSignedMessageHash(message);
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, _signature);
        require(recoveredSigner == _signer, "Invalid signature");


        custodyState[_id] = _state;
        emit CustodyStateChanged(_id, _state);
    }

    /// @notice Executes dispute settlement.
    /// @param _id The custody identifier.
    /// @param _token The token address.
    /// @param _amount The amount involved in the dispute.
    /// @param _nullifier The nullifier (hash) associated with the dispute.
    /// @param _merkleProof The Merkle proof for whitelisting.
    function executeDisputeSettlement(
        bytes32 _id,
        address _token,
        uint256 _amount,
        bytes32 _nullifier,
        bytes32[] calldata _merkleProof
    ) public checkCustodyState(_id, 2) { 
        bytes32 leaf = keccak256(abi.encode(
            "executeDisputeSettlement",
            block.chainid,
            address(this),
            custodyState[_id],
            msg.sender // check msg.sender is SettleMaker
        ));
        require(MerkleProof.verify(_merkleProof, _getPPM(_id), leaf), "Invalid merkle proof");

        nullifier[_nullifier] = true;
        seizedBalances[_id][_token] -= _amount;

    
        /*Verify(bytes calldata _zkProof,
            bytes32 _nullifier,
            bytes32 _id)
        */
    }

    /// @notice Retrieves or sets the PPM for a given custody id.
    /// @param _id The custody identifier.
    /// @return The PPM associated with the given id.
    function _getPPM(bytes32 _id) internal returns (bytes32) {
        if (PPMs[_id] == bytes32(0)) {
            PPMs[_id] = _id; // or assign the correct bytes32 root
        }
        return PPMs[_id];
    }   
}

