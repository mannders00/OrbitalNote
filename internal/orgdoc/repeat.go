package orgdoc

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var repeatRE = regexp.MustCompile(`^(\+\+|\.\+|\+)([1-9][0-9]*)([hdwmy])$`)

// Keep the actual completion timestamp in the standard state log, and record
// the occurrence separately before advancing the planning timestamps.
const occurrenceMarker = " ; occurrence "

func nextRepeat(date, clock, repeater string, now time.Time) (time.Time, error) {
	m := repeatRE.FindStringSubmatch(repeater)
	if m == nil {
		return time.Time{}, errors.New("invalid repeater; use +1d, ++1w, or .+1m")
	}
	n, err := strconv.Atoi(m[2])
	if err != nil || n > 10000 {
		return time.Time{}, errors.New("repeat interval is too large")
	}
	if clock == "" {
		if m[3] == "h" {
			return time.Time{}, errors.New("hourly repeaters require a time")
		}
		clock = "00:00"
	}
	dateTime, err := time.ParseInLocation("2006-01-02 15:04", date+" "+clock, now.Location())
	if err != nil {
		return time.Time{}, err
	}
	if m[1] == ".+" {
		dateTime = time.Date(now.Year(), now.Month(), now.Day(), dateTime.Hour(), dateTime.Minute(), 0, 0, now.Location())
		if m[3] == "h" {
			dateTime = now
		}
	}
	step := func(t time.Time) time.Time {
		switch m[3] {
		case "h":
			return t.Add(time.Duration(n) * time.Hour)
		case "d":
			return t.AddDate(0, 0, n)
		case "w":
			return t.AddDate(0, 0, 7*n)
		default:
			months := n
			if m[3] == "y" {
				months *= 12
			}
			first := time.Date(t.Year(), t.Month()+time.Month(months), 1, t.Hour(), t.Minute(), 0, 0, t.Location())
			day := t.Day()
			last := first.AddDate(0, 1, -1).Day()
			if day > last {
				day = last
			}
			return first.AddDate(0, 0, day-1)
		}
	}
	for i := 0; i < 100000; i++ {
		dateTime = step(dateTime)
		if m[1] != "++" || dateTime.After(now) {
			return dateTime, nil
		}
	}
	return time.Time{}, errors.New("repeater is too far in the past")
}

func completeRepeater(source string, h Heading, doneState string) (string, bool, error) {
	return completeRepeaterAt(source, h, doneState, time.Now())
}

func completeRepeaterAt(source string, h Heading, doneState string, now time.Time) (string, bool, error) {
	out := source
	repeated := false
	var occurrences []string
	for i := len(h.Dates) - 1; i >= 0; i-- {
		stamp := h.Dates[i]
		if stamp.Repeater == "" || (stamp.Kind != "scheduled" && stamp.Kind != "deadline") {
			continue
		}
		if stamp.EndDate != "" {
			return "", true, errors.New("multi-day repeating ranges must be edited in source")
		}
		next, err := nextRepeat(stamp.Date, stamp.Time, stamp.Repeater, now)
		if err != nil {
			return "", true, err
		}
		replacement := "<" + next.Format("2006-01-02 Mon")
		if stamp.Time != "" {
			replacement += " " + next.Format("15:04")
			if stamp.EndTime != "" {
				start, _ := time.Parse("15:04", stamp.Time)
				end, _ := time.Parse("15:04", stamp.EndTime)
				replacement += "-" + next.Add(end.Sub(start)).Format("15:04")
			}
		}
		replacement += " " + stamp.Repeater
		if warning := regexp.MustCompile(` -\d+[hdwmy]`).FindString(stamp.Raw); warning != "" {
			replacement += warning
		}
		replacement += ">"
		out = out[:stamp.Start] + replacement + out[stamp.End:]
		original := strings.Replace(stamp.Raw, " "+stamp.Repeater, "", 1)
		original = "[" + original[1:len(original)-1] + "]"
		occurrences = append([]string{strings.ToUpper(stamp.Kind) + ": " + original}, occurrences...)
		repeated = true
	}
	if !repeated {
		return source, false, nil
	}
	at, end, eol := ownBody(out, h.Line)
	entry := fmt.Sprintf("- State %q from %q [%s]%s%s%s", strings.TrimSpace(doneState), h.State, now.Format("2006-01-02 Mon 15:04"), occurrenceMarker, strings.Join(occurrences, " "), eol)
	drawer := regexp.MustCompile(`(?m)^:LOGBOOK:[ \t]*\r?\n`).FindStringIndex(out[at:end])
	if drawer != nil {
		p := at + drawer[1]
		out = out[:p] + entry + out[p:]
	} else {
		prefix := ""
		if end > 0 && out[end-1] != '\n' {
			prefix = eol
		}
		out = out[:end] + prefix + ":LOGBOOK:" + eol + entry + ":END:" + eol + out[end:]
	}
	return out, true, nil
}
