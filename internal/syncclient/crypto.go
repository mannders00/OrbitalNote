// Package syncclient implements the private-preview v1 encrypted file protocol.
// Neither file paths, plaintext hashes, nor encryption keys are sent to the server.
package syncclient

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"io/fs"
	"path"
	"strings"
	"unicode/utf8"
)

const MaxNote = 8 << 20
const MaxCipher = 9 << 20

type Keys struct {
	Vault  string
	secret []byte
	aead   cipher.AEAD
	names  []byte
}
type Document struct {
	Path    string
	Source  []byte
	Deleted bool
}

func NewKeys() (*Keys, error) {
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	return makeKeys(hex.EncodeToString(b[:16]), b[16:])
}
func ParseRecovery(text string) (*Keys, error) {
	parts := strings.Split(strings.TrimSpace(text), ".")
	if len(parts) != 3 || parts[0] != "on1" {
		return nil, errors.New("invalid OrbitalNote recovery key")
	}
	id, e := hex.DecodeString(parts[1])
	if e != nil || len(id) != 16 || parts[1] != strings.ToLower(parts[1]) {
		return nil, errors.New("invalid workspace ID")
	}
	secret, e := base64.RawURLEncoding.DecodeString(parts[2])
	if e != nil || len(secret) != 32 {
		return nil, errors.New("invalid recovery key")
	}
	return makeKeys(parts[1], secret)
}
func makeKeys(vault string, secret []byte) (*Keys, error) {
	encryption, err := hkdf.Key(sha256.New, secret, nil, "OrbitalNote/v1/encryption/"+vault, 32)
	if err != nil {
		return nil, err
	}
	names, err := hkdf.Key(sha256.New, secret, nil, "OrbitalNote/v1/names/"+vault, 32)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(encryption)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return nil, err
	}
	return &Keys{vault, secret, aead, names}, nil
}
func (k *Keys) Recovery() string {
	return "on1." + k.Vault + "." + base64.RawURLEncoding.EncodeToString(k.secret)
}
func (k *Keys) FileID(p string) string {
	h := hmac.New(sha256.New, k.names)
	h.Write([]byte(p))
	return hex.EncodeToString(h.Sum(nil))
}
func (k *Keys) Check() []byte {
	return k.aead.Seal(nil, nil, []byte("OrbitalNote Sync v1"), []byte("vault:"+k.Vault))
}
func (k *Keys) Verify(check []byte) error {
	b, e := k.aead.Open(nil, nil, check, []byte("vault:"+k.Vault))
	if e != nil || string(b) != "OrbitalNote Sync v1" {
		return errors.New("recovery key does not unlock this workspace")
	}
	return nil
}
func validPath(p string) bool {
	if !fs.ValidPath(p) || len(p) > 1024 || strings.ContainsAny(p, "\\:\x00\r\n") || !strings.EqualFold(path.Ext(p), ".org") {
		return false
	}
	for _, part := range strings.Split(p, "/") {
		if strings.HasPrefix(part, ".") {
			return false
		}
	}
	return true
}
func (k *Keys) Encrypt(d Document) ([]byte, error) {
	if !validPath(d.Path) || len(d.Source) > MaxNote || !utf8.Valid(d.Source) || (d.Deleted && len(d.Source) != 0) {
		return nil, errors.New("invalid sync document")
	}
	b := make([]byte, 3+len(d.Path)+len(d.Source))
	if d.Deleted {
		b[0] = 1
	}
	binary.BigEndian.PutUint16(b[1:3], uint16(len(d.Path)))
	copy(b[3:], d.Path)
	copy(b[3+len(d.Path):], d.Source)
	return k.aead.Seal(nil, nil, b, []byte("file:v1:"+k.Vault+":"+k.FileID(d.Path))), nil
}
func (k *Keys) Decrypt(id string, data []byte) (Document, error) {
	var d Document
	if len(data) > MaxCipher {
		return d, errors.New("encrypted object too large")
	}
	b, err := k.aead.Open(nil, nil, data, []byte("file:v1:"+k.Vault+":"+id))
	if err != nil {
		return d, errors.New("encrypted revision authentication failed")
	}
	if len(b) < 3 || b[0] > 1 {
		return d, errors.New("invalid encrypted document")
	}
	n := int(binary.BigEndian.Uint16(b[1:3]))
	if n > len(b)-3 {
		return d, errors.New("invalid encrypted path")
	}
	d = Document{Path: string(b[3 : 3+n]), Source: b[3+n:], Deleted: b[0] == 1}
	if !validPath(d.Path) || k.FileID(d.Path) != id || len(d.Source) > MaxNote || !utf8.Valid(d.Source) || (d.Deleted && len(d.Source) != 0) {
		return Document{}, errors.New("invalid decrypted document")
	}
	return d, nil
}
