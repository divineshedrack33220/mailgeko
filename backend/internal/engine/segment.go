package engine

import (
	"strconv"
	"strings"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func segmentMatches(seg *store.Segment, c *store.Contact) bool {
	matched := 0
	for _, cond := range seg.Conditions {
		if conditionMatches(cond, c) {
			matched++
		}
	}
	if seg.MatchType == "any" {
		return matched > 0
	}
	return len(seg.Conditions) == 0 || matched == len(seg.Conditions)
}

func conditionMatches(cond store.Condition, c *store.Contact) bool {
	switch cond.Field {
	case "status":
		return compareString(cond, c.Status)
	case "email":
		return compareString(cond, c.Email)
	case "first_name":
		return compareString(cond, c.FirstName)
	case "last_name":
		return compareString(cond, c.LastName)
	case "company":
		return compareString(cond, c.Company)
	case "position":
		return compareString(cond, c.Position)
	case "country":
		return compareString(cond, c.Country)
	case "city":
		return compareString(cond, c.City)
	case "tags":
		return anyTagMatches(cond, c.Tags)
	case "lastEngagementAt":
		return compareTime(cond, c.LastEngagementAt)
	case "opens", "clicks":
		_ = cond
		return false
	default:
		if strings.HasPrefix(cond.Field, "custom.") {
			key := strings.TrimPrefix(cond.Field, "custom.")
			if val, ok := c.CustomFields[key]; ok {
				return compareString(cond, val)
			}
		}
		return false
	}
}

func compareString(cond store.Condition, val string) bool {
	switch strings.ToLower(cond.Operator) {
	case "is", "equals", "=":
		return val == cond.Value
	case "is not", "not equals", "!=":
		return val != cond.Value
	case "contains":
		return strings.Contains(val, cond.Value)
	case "does not contain":
		return !strings.Contains(val, cond.Value)
	case "starts with":
		return strings.HasPrefix(val, cond.Value)
	case "ends with":
		return strings.HasSuffix(val, cond.Value)
	}
	return false
}

func anyTagMatches(cond store.Condition, tags []string) bool {
	switch strings.ToLower(cond.Operator) {
	case "is", "equals", "contains", "has":
		for _, t := range tags {
			if t == cond.Value {
				return true
			}
		}
		return false
	case "is not", "does not contain":
		for _, t := range tags {
			if t == cond.Value {
				return false
			}
		}
		return true
	}
	return false
}

func compareTime(cond store.Condition, t *time.Time) bool {
	if t == nil {
		return false
	}
	duration, err := parseDurationValue(cond.Value)
	if err != nil {
		return false
	}
	boundary := time.Now().Add(duration)
	switch strings.ToLower(cond.Operator) {
	case "is after", "after", "greater than":
		return t.After(boundary)
	case "is before", "before", "less than":
		return t.Before(boundary)
	}
	return false
}

func parseDurationValue(v string) (time.Duration, error) {
	v = strings.TrimSpace(v)
	if n, err := strconv.Atoi(v); err == nil {
		return -time.Duration(n) * 24 * time.Hour, nil
	}
	fields := strings.Fields(v)
	if len(fields) == 2 || len(fields) == 3 {
		n, err := strconv.Atoi(fields[0])
		if err != nil {
			return 0, err
		}
		if len(fields) == 3 && !strings.EqualFold(fields[2], "ago") {
			return 0, nil
		}
		switch strings.ToLower(fields[1]) {
		case "day", "days":
			return -time.Duration(n) * 24 * time.Hour, nil
		case "hour", "hours":
			return -time.Duration(n) * time.Hour, nil
		case "week", "weeks":
			return -time.Duration(n) * 7 * 24 * time.Hour, nil
		}
	}
	return 0, nil
}
