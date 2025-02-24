from Crypto.Hash import keccak

def keccak256(left: bytes, right: bytes) -> bytes:
    """Compute Keccak-256 hash of two values, matching Solidity's abi.encodePacked"""
    k = keccak.new(digest_bits=256)
    k.update(left + right)
    return k.digest()

def _insert(commitment: bytes, next_index: int, zeros: list, filled_subtrees: list) -> tuple:
    """Insert a new commitment into the Merkle tree and return new root"""
    current_hash = commitment
    current_index = next_index
    
    # Initialize filled_subtrees if empty
    if not filled_subtrees:
        filled_subtrees = zeros.copy()
    
    # Compute the new root
    for level in range(10):  # TREE_LEVELS = 10
        if current_index % 2 == 0:
            filled_subtrees[level] = current_hash
            current_hash = keccak256(current_hash, zeros[level])
        else:
            current_hash = keccak256(filled_subtrees[level], current_hash)
        current_index //= 2
        
    return current_hash, filled_subtrees

def main():
    # Initialize zeros array matching Solidity contract
    zeros = []
    current_zero = (0).to_bytes(32, 'big')
    
    # Generate zeros for each level
    for i in range(10):  # TREE_LEVELS = 10
        zeros.append(current_zero)
        current_zero = keccak256(current_zero, current_zero)
    
    # The root is the last zero value
    root = zeros[-1]
    print(f"Initial Merkle root: 0x{root.hex()}")

    # Insert a test commitment
    test_commitment = bytes.fromhex('1cb1b16d77322dc69122683e8d4576fa3a1315a6a8231ce36fb5b3913f44a93a')
    filled_subtrees = []
    
    new_root, filled_subtrees = _insert(test_commitment, 0, zeros, filled_subtrees)
    print(f"Merkle root after insertion: 0x{new_root.hex()}")
    
if __name__ == "__main__":
    main()
