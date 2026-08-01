package store

import (
	"encoding/json"
	"testing"
)

func TestAutomationRowTriggerConditions(t *testing.T) {
	row := automationRow{
		TriggerConditions: []byte(`[{"field":"email","op":"contains","value":"@acme.com"}]`),
	}
	a := row.toAutomation()
	if len(a.TriggerConditions) != 1 {
		t.Fatalf("expected 1 condition, got %d", len(a.TriggerConditions))
	}
	if a.TriggerConditions[0].Value != "@acme.com" {
		t.Fatalf("expected condition value %q, got %q", "@acme.com", a.TriggerConditions[0].Value)
	}
}

func TestAutomationRowTriggerConditionsEmpty(t *testing.T) {
	for _, b := range [][]byte{nil, []byte(""), []byte("null"), []byte("[]")} {
		a := automationRow{TriggerConditions: b}.toAutomation()
		if a.TriggerConditions == nil {
			t.Fatalf("triggerConditions(%v) must not be nil", b)
		}
		if len(a.TriggerConditions) != 0 {
			t.Fatalf("triggerConditions(%v) expected empty, got %d", b, len(a.TriggerConditions))
		}
	}
}

func TestUnmarshalStringSliceNeverNil(t *testing.T) {
	for _, b := range [][]byte{nil, []byte(""), []byte("null"), []byte("[]")} {
		out := unmarshalStringSlice(b)
		if out == nil {
			t.Fatalf("unmarshalStringSlice(%v) must not return nil", b)
		}
	}
	out := unmarshalStringSlice([]byte(`["a"]`))
	if len(out) != 1 || out[0] != "a" {
		t.Fatalf("unexpected unmarshalStringSlice result: %#v", out)
	}
}

func TestMarshalJSONNilSliceEmitsArray(t *testing.T) {
	var s []string
	if string(marshalJSON(s)) != "null" {
		t.Fatalf("expected json.Marshal(nil []string) == \"null\", got %s", marshalJSON(s))
	}
	var raw json.RawMessage
	if string(marshalJSON(raw)) != "null" {
		t.Fatalf("expected json.Marshal(nil RawMessage) == \"null\", got %s", marshalJSON(raw))
	}
}
