package syncclient

import (
	"bytes"
	"testing"
)

func TestEncryptionRecoveryAndTampering(t *testing.T) {
	k, err := NewKeys()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := ParseRecovery(k.Recovery())
	if err != nil {
		t.Fatal(err)
	}
	d := Document{Path: "private/Plans.org", Source: []byte("* Secret trip\r\nDo not normalize me.\n")}
	a, err := k.Encrypt(d)
	if err != nil {
		t.Fatal(err)
	}
	b, err := k.Encrypt(d)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(a, b) {
		t.Fatal("encryption reused a nonce")
	}
	if bytes.Contains(a, d.Source) || bytes.Contains(a, []byte(d.Path)) {
		t.Fatal("plaintext leaked")
	}
	got, err := restored.Decrypt(k.FileID(d.Path), a)
	if err != nil || !bytes.Equal(got.Source, d.Source) || got.Path != d.Path {
		t.Fatal("recovery failed", err)
	}
	if err = restored.Verify(k.Check()); err != nil {
		t.Fatal(err)
	}
	a[len(a)-1] ^= 1
	if _, err = restored.Decrypt(k.FileID(d.Path), a); err == nil {
		t.Fatal("tampering accepted")
	}
	if _, err = restored.Decrypt(k.FileID("other.org"), b); err == nil {
		t.Fatal("file substitution accepted")
	}
	other, _ := NewKeys()
	if _, err = other.Decrypt(k.FileID(d.Path), b); err == nil {
		t.Fatal("wrong key accepted")
	}
	if _, err = k.Encrypt(Document{Path: "../escape.org"}); err == nil {
		t.Fatal("path traversal accepted")
	}
	if _, err = k.Encrypt(Document{Path: ".orbitalnote.org", Source: []byte("settings")}); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{".secret.org", "nested/.orbitalnote.org", ".orbitalnote.org/secret.org"} {
		if _, err = k.Encrypt(Document{Path: p}); err == nil {
			t.Fatalf("accepted hidden path %s", p)
		}
	}
}
