/// True for loopback TCP peers (same machine as the server).
pub fn is_loopback_address(address: &str) -> bool {
    if address.is_empty() {
        return false;
    }
    if address == "127.0.0.1" || address == "::1" || address == "::ffff:127.0.0.1" {
        return true;
    }
    address.starts_with("127.")
}

/// Alias for checking whether a remote address is local to the server.
pub fn is_local_addr(address: &str) -> bool {
    is_loopback_address(address)
}
