use base64::Engine;
use regex::Regex;
use std::sync::OnceLock;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OscCommandReport {
    pub command_exit: Option<i32>,
    pub command_line: Option<String>,
}

fn decode_cmd_part(part: &str) -> Option<String> {
    if let Some(b64) = part.strip_prefix("cmd_b64=") {
        return base64::engine::general_purpose::STANDARD
            .decode(b64)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok());
    }
    if let Some(cmd) = part.strip_prefix("cmd=") {
        return Some(cmd.to_string());
    }
    None
}

pub fn parse_osc133_command(payload: &str) -> Option<OscCommandReport> {
    let mut parts = payload.split(';');
    if parts.next()? != "C" {
        return None;
    }

    let mut command_exit = None;
    let mut command_line = None;

    for part in parts {
        if let Some(code) = part.strip_prefix("exit=") {
            if let Ok(parsed) = code.parse::<i32>() {
                command_exit = Some(parsed);
            }
            continue;
        }
        if let Some(cmd) = decode_cmd_part(part) {
            command_line = Some(cmd);
        }
    }

    if command_exit.is_none() && command_line.is_none() {
        return None;
    }

    Some(OscCommandReport {
        command_exit,
        command_line,
    })
}

fn osc_re() -> &'static Regex {
    static OSC_RE: OnceLock<Regex> = OnceLock::new();
    OSC_RE.get_or_init(|| Regex::new(r"\x1b\]([0-9]+);([\s\S]*?)(?:\x07|\x1b\\)").expect("OSC regex"))
}

pub struct OscStreamParseResult {
    pub carry: String,
    pub reports: Vec<OscCommandReport>,
}

pub fn parse_osc_stream(carry: &str, chunk: &str) -> OscStreamParseResult {
    let text = format!("{carry}{chunk}");
    let mut reports = Vec::new();
    let mut last_complete = 0usize;

    for caps in osc_re().captures_iter(&text) {
        let full = caps.get(0).expect("full match");
        last_complete = full.end();
        let code = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let payload = caps.get(2).map(|m| m.as_str()).unwrap_or("");
        if code != "133" {
            continue;
        }
        if let Some(report) = parse_osc133_command(payload) {
            reports.push(report);
        }
    }

    let tail = &text[last_complete..];
    let carry_start = tail.rfind("\x1b]");
    let next_carry = carry_start
        .map(|idx| tail[idx..].to_string())
        .unwrap_or_default();

    OscStreamParseResult {
        carry: next_carry,
        reports,
    }
}
