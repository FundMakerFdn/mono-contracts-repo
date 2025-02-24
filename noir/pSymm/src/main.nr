fn compute_merkle_root<let N: u32>(leaf: [u8; 32], index: Field, hash_path: [[u8; 32]; N]) -> [u8; 32] {
    let index_bits: [u1; N] = index.to_le_bits();
    let mut current = leaf;
    for i in 0..N {
        let path_bit = index_bits[i] as bool;
        let (hash_left, hash_right) = if path_bit {
            (hash_path[i], current)
        } else {
            (current, hash_path[i])
        };
        let mut acc: [u8; 64] = [0; 64];
        for i in 0..32 {
            acc[i] = hash_left[i];
            acc[i + 32] = hash_right[i];
        }
        current = std::hash::keccak256(acc, acc.len());
    }
    current
}

struct Note {
    nullifier: [u8; 32],
    amount: [u8; 32], // LE-encoded (0x1234.. = [.., 0x34, 0x12])
    token: [u8; 32],
    secret_nonce: [u8; 32],
}

fn hashNote(note: Note, custody_id: [u8; 32]) -> [u8; 32] {
    let mut acc: [u8; 160] = [0; 160]; // 32 * 5 = 160 bytes
    
    // Concatenate all inputs
    for i in 0..32 {
        acc[i] = note.nullifier[i];
        acc[i + 32] = note.amount[i];
        acc[i + 64] = note.token[i];
        acc[i + 96] = custody_id[i];
        acc[i + 128] = note.secret_nonce[i];
    }
    
    // Hash the concatenated array
    std::hash::keccak256(acc, acc.len())
}

// CTC
// Split note into note_a + note_b
fn main(
    note: Note, note_a: Note, note_b: Note,
    note_index: Field, note_hash_path: [[u8; 32]; 10], // commitment merkle
    note_commitment: [u8; 32],
    noteA_commitment: [u8; 32],
    noteB_commitment: [u8; 32],
    nullifier_hash: pub [u8; 32], root: pub [u8; 32], note_custody_id: pub [u8; 32],
    noteA_custody_id: [u8; 32], noteB_custody_id: [u8; 32]
) {
    // Verify nullifier hash
    let computed_nullifier = std::hash::keccak256(note.nullifier, note.nullifier.len());
    assert(nullifier_hash == computed_nullifier);

    // Verify note commitment
    let computed_note_commitment = hashNote(note, note_custody_id);
    assert(note_commitment == computed_note_commitment);

    // Verify merkle root
    let computed_root = compute_merkle_root(note_commitment, note_index, note_hash_path);
    assert(root == computed_root);

    // Verify tokens match
    for i in 0..32 {
        assert(note.token[i] == note_a.token[i]);
        assert(note.token[i] == note_b.token[i]);
    }

    // Verify amount splitting (byte by byte addition with carry)
    // LeToInt(note.amount) == LEtoInt(noteA.amount) + LEtoInt(noteB.amount)
    let mut carry: u8 = 0;
    for i in 0..32 {
        let sum = (note_a.amount[i] as u16) + (note_b.amount[i] as u16) + (carry as u16);
        assert(note.amount[i] == (sum % 256) as u8);
        carry = (sum / 256) as u8;
    }
    assert(carry == 0); // Ensure no overflow

    // Verify note commitments
    let computed_noteA_commitment = hashNote(note_a, noteA_custody_id);
    let computed_noteB_commitment = hashNote(note_b, noteB_custody_id);
    assert(noteA_commitment == computed_noteA_commitment);
    assert(noteB_commitment == computed_noteB_commitment);
}

