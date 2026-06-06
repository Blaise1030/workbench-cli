package auth

import (
	"regexp"
	"testing"
)

func TestCreateSession_Format(t *testing.T) {
	s := CreateSession()
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(s.SID()) {
		t.Errorf("expected 64-char hex SID, got %q", s.SID())
	}
	if s.Active() {
		t.Error("expected session to be inactive on creation")
	}
}

func TestCreateSession_Unique(t *testing.T) {
	if CreateSession().SID() == CreateSession().SID() {
		t.Error("expected unique sids")
	}
}

func TestActivate(t *testing.T) {
	s := CreateSession()
	s.Activate()
	if !s.Active() {
		t.Error("expected active after Activate()")
	}
}

func TestDeactivate(t *testing.T) {
	s := CreateSession()
	s.Activate()
	s.Deactivate()
	if s.Active() {
		t.Error("expected inactive after Deactivate()")
	}
}

func TestValidate_MatchingActiveSID(t *testing.T) {
	s := CreateSession()
	s.Activate()
	if !s.Validate(s.SID()) {
		t.Error("expected Validate to return true for matching active sid")
	}
}

func TestValidate_WrongSID(t *testing.T) {
	s := CreateSession()
	s.Activate()
	if s.Validate("wrong") {
		t.Error("expected Validate to return false for wrong sid")
	}
}

func TestValidate_Inactive(t *testing.T) {
	s := CreateSession()
	s.Activate()
	s.Deactivate()
	if s.Validate(s.SID()) {
		t.Error("expected Validate to return false when inactive")
	}
}
