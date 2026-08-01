package analytics

import "testing"

func TestDetectDevice(t *testing.T) {
	cases := []struct {
		ua       string
		name     string
		category string
		platform string
	}{
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15", "iPhone", "mobile", "iOS"},
		{"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15", "iPad", "tablet", "iOS"},
		{"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36", "Android", "mobile", "Android"},
		{"Mozilla/5.0 (Linux; Android 13; SM-T970) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", "Android Tablet", "tablet", "Android"},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0", "Mac", "desktop", "macOS"},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0", "Windows", "desktop", "Windows"},
		{"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0", "Linux", "desktop", "Linux"},
		{"", "Unknown", "unknown", "other"},
	}
	for _, c := range cases {
		got := DetectDevice(c.ua)
		if got.Name != c.name || got.Category != c.category || got.Platform != c.platform {
			t.Errorf("DetectDevice(%q) = %+v, want name=%s category=%s platform=%s",
				c.ua, got, c.name, c.category, c.platform)
		}
	}
}

func TestCountryName(t *testing.T) {
	if got := CountryName("us"); got != "United States" {
		t.Errorf("CountryName(us) = %q, want United States", got)
	}
	if got := CountryName("KE"); got != "Kenya" {
		t.Errorf("CountryName(KE) = %q, want Kenya", got)
	}
	if got := CountryName(""); got != "Unknown" {
		t.Errorf("CountryName() = %q, want Unknown", got)
	}
}
