package terminal

import (
	"encoding/base64"
	"regexp"
	"strconv"
	"strings"
)

// OscCommandReport mirrors OscCommandReport from osc-parser.ts.
type OscCommandReport struct {
	CommandExit *int    `json:"commandExit,omitempty"`
	CommandLine *string `json:"commandLine,omitempty"`
}

var oscRE = regexp.MustCompile(`\x1b\]([0-9]+);([\s\S]*?)(?:\x07|\x1b\\)`)

func decodeCmdPart(part string) *string {
	if strings.HasPrefix(part, "cmd_b64=") {
		b, err := base64.StdEncoding.DecodeString(part[8:])
		if err != nil {
			return nil
		}
		s := string(b)
		return &s
	}
	if strings.HasPrefix(part, "cmd=") {
		s := part[4:]
		return &s
	}
	return nil
}

func parseOsc133Command(payload string) *OscCommandReport {
	parts := strings.SplitN(payload, ";", -1)
	if len(parts) == 0 || parts[0] != "C" {
		return nil
	}
	var report OscCommandReport
	for _, part := range parts[1:] {
		if strings.HasPrefix(part, "exit=") {
			n, err := strconv.Atoi(part[5:])
			if err == nil {
				report.CommandExit = &n
			}
			continue
		}
		if s := decodeCmdPart(part); s != nil {
			report.CommandLine = s
		}
	}
	if report.CommandExit == nil && report.CommandLine == nil {
		return nil
	}
	return &report
}

// ParseOscStream mirrors parseOscStream from osc-parser.ts.
func ParseOscStream(carry, chunk string) (newCarry string, reports []OscCommandReport) {
	text := carry + chunk
	lastComplete := 0
	matches := oscRE.FindAllStringSubmatchIndex(text, -1)
	for _, loc := range matches {
		code := text[loc[2]:loc[3]]
		payload := text[loc[4]:loc[5]]
		lastComplete = loc[1]
		if code != "133" {
			continue
		}
		if r := parseOsc133Command(payload); r != nil {
			reports = append(reports, *r)
		}
	}
	tail := text[lastComplete:]
	carryStart := strings.LastIndex(tail, "\x1b]")
	if carryStart == -1 {
		newCarry = ""
	} else {
		newCarry = tail[carryStart:]
	}
	return newCarry, reports
}
