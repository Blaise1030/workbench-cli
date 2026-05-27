use std::net::{IpAddr, Ipv4Addr, UdpSocket};

/// Returns the first non-internal IPv4 address, or 127.0.0.1 if none found.
pub fn get_lan_ip() -> String {
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                if let IpAddr::V4(v4) = addr.ip() {
                    if !v4.is_loopback() && !v4.is_unspecified() {
                        return v4.to_string();
                    }
                }
            }
        }
    }

    if let Ok(addrs) = local_ipv4_addresses() {
        if let Some(ip) = addrs.into_iter().find(|ip| !ip.is_loopback() && !ip.is_unspecified()) {
            return ip.to_string();
        }
    }

    Ipv4Addr::LOCALHOST.to_string()
}

fn local_ipv4_addresses() -> std::io::Result<Vec<Ipv4Addr>> {
    let output = std::process::Command::new("ifconfig")
        .output()
        .or_else(|_| std::process::Command::new("ip").args(["-4", "addr"]).output())?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut addrs = Vec::new();
    for token in text.split_whitespace() {
        if let Ok(ip) = token.parse::<Ipv4Addr>() {
            addrs.push(ip);
        } else if let Some(rest) = token.strip_prefix("inet ") {
            if let Some(ip_str) = rest.split('/').next() {
                if let Ok(ip) = ip_str.parse::<Ipv4Addr>() {
                    addrs.push(ip);
                }
            }
        }
    }
    Ok(addrs)
}
