from Crypto.Hash import keccak

def keccak256(data: bytes) -> bytes:
    """Compute Keccak-256 hash of data"""
    k = keccak.new(digest_bits=256)
    k.update(data)
    return k.digest()

def to_le_bits(index: int, num_bits: int = 10) -> list:
    """Convert index to list of least significant bits"""
    return [(index >> i) & 1 for i in range(num_bits)]

def main(leaf: bytes, index: int, hash_path: list, root: bytes) -> bytes:
    """
    Verify a Merkle proof
    
    Args:
        leaf: 32-byte leaf node
        index: Position in tree
        hash_path: List of 10 32-byte hashes
        root: 32-byte root hash
    
    Returns:
        bytes: Computed root hash
    """
    index_bits = to_le_bits(index)
    current = leaf
    
    for i in range(10):
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
    # Create test note data
    nullifier = b'\xAA'*32
    amount = (1234).to_bytes(32, 'little')  # 1234 in little-endian
    token = b'\x88' * 32
    secret_nonce = b"nonc"*8
    custody_id = b"\x11"*32

    # Concatenate note fields (same as hashNote in Noir)
    note_data = nullifier + amount + token + custody_id + secret_nonce
    
    # Create 1024 leaves (2^10)
    # First leaf is our note hash, rest are zeros
    raw_zero = b"\x00" * 32
    
    idx = 0
    
    # Hash the note data as first leaf
    leaves = [raw_zero for _ in range(1024)]
    leaves[idx] = keccak256(note_data)
    print(keccak256(note_data))
    
    # Build the full tree level by level
    current_level = leaves
    tree_nodes = [current_level]
    
    while len(current_level) > 1:
        next_level = []
        for i in range(0, len(current_level), 2):
            left = current_level[i]
            right = current_level[i + 1] if i + 1 < len(current_level) else current_level[i]
            parent = keccak256(left + right)
            next_level.append(parent)
        current_level = next_level
        tree_nodes.append(current_level)
    
    root = tree_nodes[-1][0]
    
    # Generate proof for leaf1 at index 0
    proof = []
    node_idx = idx
    
    for level in tree_nodes[:-1]:  # Exclude root level
        sibling_idx = node_idx - 1 if node_idx % 2 == 1 else node_idx + 1
        if sibling_idx < len(level):
            proof.append(level[sibling_idx])
        else:
            proof.append(level[node_idx])  # Use self if no sibling
        node_idx //= 2
    
    computed_root = main(leaves[idx], idx, proof, root)
    
    # Create noteA and noteB that sum to original note
    amount_a = 500  # First split amount
    amount_b = 734  # Second split amount (500 + 734 = 1234)
    
    # Create noteA
    noteA = {
        'nullifier': b'\xBB'*32,
        'amount': amount_a.to_bytes(32, 'little'),
        'token': token,  # Same token as original
        'secret_nonce': b"nncA"*8
    }
    noteA_custody_id = b"\x22"*32
    noteA_data = noteA['nullifier'] + noteA['amount'] + noteA['token'] + noteA_custody_id + noteA['secret_nonce']
    noteA_commitment = keccak256(noteA_data)

    # Create noteB
    noteB = {
        'nullifier': b'\xCC'*32,
        'amount': amount_b.to_bytes(32, 'little'),
        'token': token,  # Same token as original
        'secret_nonce': b"nncB"*8
    }
    noteB_custody_id = b"\x33"*32
    noteB_data = noteB['nullifier'] + noteB['amount'] + noteB['token'] + noteB_custody_id + noteB['secret_nonce']
    noteB_commitment = keccak256(noteB_data)

    # Format bytes as comma-separated strings for Prover.toml
    def bytes_to_toml_array(b):
        return '[' + ', '.join(f'{x}' for x in b) + ']'

    # Print Prover.toml format
    print(f"noteA_commitment = {bytes_to_toml_array(noteA_commitment)}")
    print(f"noteA_custody_id = {bytes_to_toml_array(noteA_custody_id)}")
    print(f"noteB_commitment = {bytes_to_toml_array(noteB_commitment)}")
    print(f"noteB_custody_id = {bytes_to_toml_array(noteB_custody_id)}")
    print(f"note_commitment = {bytes_to_toml_array(leaves[idx])}")
    print(f"note_custody_id = {bytes_to_toml_array(custody_id)}")
    print(f"note_hash_path = [")
    for h in proof:
        print(f"    {bytes_to_toml_array(h)},")
    print("]")
    print(f"note_index = {idx}")
    print(f"nullifier_hash = {bytes_to_toml_array(keccak256(nullifier))}")
    print(f"root = {bytes_to_toml_array(root)}")
    print()
    print("[note]")
    print(f"amount = {bytes_to_toml_array(amount)}")
    print(f"nullifier = {bytes_to_toml_array(nullifier)}")
    print(f"secret_nonce = {bytes_to_toml_array(secret_nonce)}")
    print(f"token = {bytes_to_toml_array(token)}")
    print()
    print("[note_a]")
    print(f"amount = {bytes_to_toml_array(noteA['amount'])}")
    print(f"nullifier = {bytes_to_toml_array(noteA['nullifier'])}")
    print(f"secret_nonce = {bytes_to_toml_array(noteA['secret_nonce'])}")
    print(f"token = {bytes_to_toml_array(noteA['token'])}")
    print()
    print("[note_b]")
    print(f"amount = {bytes_to_toml_array(noteB['amount'])}")
    print(f"nullifier = {bytes_to_toml_array(noteB['nullifier'])}")
    print(f"secret_nonce = {bytes_to_toml_array(noteB['secret_nonce'])}")
    print(f"token = {bytes_to_toml_array(noteB['token'])}")
