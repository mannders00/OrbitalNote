package workspace

import "sort"

type Tag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

func (s *Service) Tags(id uint64) ([]Tag, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.check(id); err != nil {
		return nil, err
	}
	counts := map[string]int{}
	for _, n := range s.notes {
		for _, tag := range n.FileTags {
			counts[tag]++
		}
		for _, h := range n.Headings {
			for _, tag := range h.Tags {
				counts[tag]++
			}
		}
	}
	tags := make([]Tag, 0, len(counts))
	for name, count := range counts {
		tags = append(tags, Tag{name, count})
	}
	sort.Slice(tags, func(i, j int) bool { return tags[i].Name < tags[j].Name })
	return tags, nil
}
