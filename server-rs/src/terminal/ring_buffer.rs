/// Byte-capped ring buffer for terminal scrollback (matches server ring-buffer.ts).
pub struct RingBuffer {
    chunks: Vec<Vec<u8>>,
    total_bytes: usize,
    cap_bytes: usize,
}

impl RingBuffer {
    pub fn new(cap_bytes: usize) -> Self {
        Self {
            chunks: Vec::new(),
            total_bytes: 0,
            cap_bytes,
        }
    }

    pub fn append(&mut self, data: impl AsRef<[u8]>) {
        let buf = data.as_ref();
        if buf.is_empty() {
            return;
        }
        self.chunks.push(buf.to_vec());
        self.total_bytes += buf.len();
        while self.total_bytes > self.cap_bytes && !self.chunks.is_empty() {
            let removed = self.chunks.remove(0);
            self.total_bytes -= removed.len();
        }
    }

    pub fn snapshot(&self) -> Vec<u8> {
        if self.chunks.is_empty() {
            return Vec::new();
        }
        self.chunks.iter().flatten().copied().collect()
    }

    pub fn byte_length(&self) -> usize {
        self.total_bytes
    }
}
