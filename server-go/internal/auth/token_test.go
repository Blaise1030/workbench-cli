package auth

import (
	"regexp"
	"testing"
	"time"
)

var hexRE = regexp.MustCompile(`^[0-9a-f]{64}$`)

func TestCreateToken_Format(t *testing.T) {
	tok := CreateToken()
	if !hexRE.MatchString(tok.Value) {
		t.Errorf("expected 64-char hex, got %q", tok.Value)
	}
}

func TestCreateToken_ExpiresInOneHour(t *testing.T) {
	before := time.Now()
	tok := CreateToken()
	after := time.Now()
	lo := before.Add(tokenTTL)
	hi := after.Add(tokenTTL)
	if tok.ExpiresAt.Before(lo) || tok.ExpiresAt.After(hi) {
		t.Errorf("expiresAt %v not in [%v, %v]", tok.ExpiresAt, lo, hi)
	}
}

func TestCreateToken_Unique(t *testing.T) {
	if CreateToken().Value == CreateToken().Value {
		t.Error("expected unique tokens")
	}
}

func TestTokenValid_CorrectBeforeExpiry(t *testing.T) {
	tok := CreateToken()
	if !tok.Valid(tok.Value) {
		t.Error("expected valid for correct value before expiry")
	}
}

func TestTokenValid_WrongValue(t *testing.T) {
	tok := CreateToken()
	if tok.Valid("wrong") {
		t.Error("expected invalid for wrong value")
	}
}

func TestTokenExpired_AfterTTL(t *testing.T) {
	tok := SessionToken{Value: "x", ExpiresAt: time.Now().Add(-time.Millisecond)}
	if !tok.Expired() {
		t.Error("expected expired")
	}
}

func TestTokenExpired_BeforeTTL(t *testing.T) {
	tok := CreateToken()
	if tok.Expired() {
		t.Error("expected not expired")
	}
}
