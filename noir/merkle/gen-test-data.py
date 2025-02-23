from Crypto.Hash import keccak

def keccak256(data: bytes) -> bytes:
    """Compute Keccak-256 hash of data"""
    k = keccak.new(digest_bits=256)
    k.update(data)
    return k.digest()

def to_le_bits(index: int, num_bits: int = 3) -> list:
    """Convert index to list of least significant bits"""
    return [(index >> i) & 1 for i in range(num_bits)]

def main(leaf: bytes, index: int, hash_path: list, root: bytes) -> bytes:
    """
    Verify a Merkle proof
    
    Args:
        leaf: 32-byte leaf node
        index: Position in tree
        hash_path: List of 3 32-byte hashes
        root: 32-byte root hash
    
    Returns:
        bytes: Computed root hash
    """
    index_bits = to_le_bits(index)
    current = leaf
    
    for i in range(3):
        path_bit = index_bits[i]
        if path_bit:
            hash_left = hash_path[i]
            hash_right = current
        else:
            hash_left = current
            hash_right = hash_path[i]
            
        # Concatenate the 32-byte hashes
        acc = hash_left + hash_right
        
        current = keccak256(acc)
        
    return current

if __name__ == "__main__":
    # Create some sample leaf data
    raw_leaves = [
        b"leaf1" * 8,  # Make 32 bytes
        b"leaf2" * 8,
        b"leaf3" * 8,
        b"leaf4" * 8,
        b"leaf5" * 8,
        b"leaf6" * 8,
        b"leaf7" * 8,
        b"leaf8" * 8,
    ]
    
    # Hash all leaves first
    leaves = [keccak256(leaf) for leaf in raw_leaves]
    
    # Create level 1 nodes
    node01 = keccak256(leaves[0] + leaves[1])
    node23 = keccak256(leaves[2] + leaves[3])
    node45 = keccak256(leaves[4] + leaves[5])
    node67 = keccak256(leaves[6] + leaves[7])
    
    # Create level 2 nodes
    node0123 = keccak256(node01 + node23)
    node4567 = keccak256(node45 + node67)
    
    # Create root
    root = keccak256(node0123 + node4567)
    
    # Verify proof for leaf[2] at index 2
    leaf_idx = 2
    proof = [leaves[3], node01, node4567]
    
    computed_root = main(leaves[leaf_idx], leaf_idx, proof, root)
    
    # Print values in Rust array format
    def bytes_to_rust_array(b):
        return '[' + ', '.join(f'{x}' for x in b) + ']'
        # return '[' + ', '.join(f'0x{x:02x}' for x in b) + ']'
    
    print(f"let leaf: [u8; 32] = {bytes_to_rust_array(leaves[leaf_idx])};")
    print(f"let index: Field = {leaf_idx};")
    print("let hash_path: [[u8; 32]; 3] = [")
    for h in proof:
        print(f"    {bytes_to_rust_array(h)},")
    print("];")
    print(f"let expected_root: [u8; 32] = {bytes_to_rust_array(root)};")
    
    print(f"\n// Proof valid: {computed_root == root}")
