package auth

import (
	"testing"
	"time"
)

func TestInvite_ValidWhenFreshAndUnused(t *testing.T) {
	inv := CreateInvite()
	if !inv.Valid(inv.Value) {
		t.Error("expected valid for fresh unused invite")
	}
}

func TestInvite_InvalidAfterConsume(t *testing.T) {
	inv := CreateInvite()
	inv.Consume()
	if inv.Valid(inv.Value) {
		t.Error("expected invalid after consume")
	}
}

func TestInvite_InvalidAfterExpiry(t *testing.T) {
	inv := &InviteToken{
		Value:     "test",
		ExpiresAt: time.Now().Add(-time.Millisecond),
	}
	if inv.Valid("test") {
		t.Error("expected invalid after expiry")
	}
}

func TestInvite_InvalidForWrongInput(t *testing.T) {
	inv := CreateInvite()
	if inv.Valid("wrong") {
		t.Error("expected invalid for wrong input")
	}
}

func TestInvite_NilIsInvalid(t *testing.T) {
	var inv *InviteToken
	if inv.Valid("anything") {
		t.Error("expected nil invite to be invalid")
	}
}
