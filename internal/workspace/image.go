package workspace

import (
	"encoding/base64"
	"errors"
	"net/http"
)

func (s *Service) Image(id uint64, p string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return "", err
	}
	b, err := s.store.Read(p)
	if err != nil {
		return "", err
	}
	kind := http.DetectContentType(b)
	switch kind {
	case "image/png", "image/jpeg", "image/gif", "image/webp":
	default:
		return "", errors.New("preview supports local PNG, JPEG, GIF and WebP images")
	}
	return "data:" + kind + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}
