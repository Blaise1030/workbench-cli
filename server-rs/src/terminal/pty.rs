use regex::Regex;
use std::sync::OnceLock;

pub struct Resize {
    pub cols: u16,
    pub rows: u16,
}

fn resize_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\x1b\[RESIZE:(\d+);(\d+)\]$").expect("resize regex"))
}

pub fn parse_resize(msg: &str) -> Option<Resize> {
    let caps = resize_re().captures(msg)?;
    let cols = caps.get(1)?.as_str().parse().ok()?;
    let rows = caps.get(2)?.as_str().parse().ok()?;
    Some(Resize { cols, rows })
}
