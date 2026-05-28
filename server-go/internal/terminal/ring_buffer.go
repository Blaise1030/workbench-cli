package terminal

import "sync"

// RingBuffer is a cap-bounded chunk ring buffer mirroring RingBuffer in ring-buffer.ts.
type RingBuffer struct {
	mu       sync.Mutex
	chunks   [][]byte
	total    int
	capBytes int
}

func NewRingBuffer(capBytes int) *RingBuffer {
	return &RingBuffer{capBytes: capBytes}
}

func (r *RingBuffer) Append(data []byte) {
	if len(data) == 0 {
		return
	}
	buf := make([]byte, len(data))
	copy(buf, data)
	r.mu.Lock()
	r.chunks = append(r.chunks, buf)
	r.total += len(buf)
	for r.total > r.capBytes && len(r.chunks) > 0 {
		r.total -= len(r.chunks[0])
		r.chunks = r.chunks[1:]
	}
	r.mu.Unlock()
}

func (r *RingBuffer) Snapshot() []byte {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.chunks) == 0 {
		return nil
	}
	out := make([]byte, 0, r.total)
	for _, c := range r.chunks {
		out = append(out, c...)
	}
	return out
}

func (r *RingBuffer) ByteLen() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.total
}
