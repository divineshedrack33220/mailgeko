package analytics

import "strings"

type Device struct {
	Name     string
	Category string
	Platform string
}

func DetectDevice(userAgent string) Device {
	d := Device{Name: "Unknown", Category: "desktop", Platform: "other"}
	ua := strings.ToLower(userAgent)
	switch {
	case ua == "":
		return Device{Name: "Unknown", Category: "unknown", Platform: "other"}
	case strings.Contains(ua, "iphone"):
		d = Device{Name: "iPhone", Category: "mobile", Platform: "iOS"}
	case strings.Contains(ua, "ipad"):
		d = Device{Name: "iPad", Category: "tablet", Platform: "iOS"}
	case strings.Contains(ua, "ipod"):
		d = Device{Name: "iPod", Category: "mobile", Platform: "iOS"}
	case strings.Contains(ua, "android"):
		d = Device{Name: "Android", Category: "mobile", Platform: "Android"}
	case strings.Contains(ua, "crkey") || strings.Contains(ua, "chromebook"):
		d = Device{Name: "ChromeOS", Category: "desktop", Platform: "ChromeOS"}
	case strings.Contains(ua, "mac os") || strings.Contains(ua, "macintosh"):
		d = Device{Name: "Mac", Category: "desktop", Platform: "macOS"}
	case strings.Contains(ua, "windows"):
		d = Device{Name: "Windows", Category: "desktop", Platform: "Windows"}
	case strings.Contains(ua, "linux"):
		d = Device{Name: "Linux", Category: "desktop", Platform: "Linux"}
	case strings.Contains(ua, "crios"):
		d = Device{Name: "ChromiumOS", Category: "mobile", Platform: "ChromeOS"}
	}

	// Refine form factor from platform hints carried by some clients.
	switch {
	case d.Platform == "iOS" && strings.Contains(ua, "mobile"):
		// iPad with desktop UA reports Mac; keep the tablet when hinted.
		if strings.Contains(ua, "ipad") {
			d.Name = "iPad"
			d.Category = "tablet"
		}
	case d.Platform == "Android" && !strings.Contains(ua, "mobile"):
		d.Category = "tablet"
		d.Name = "Android Tablet"
	}
	return d
}

var countryCodes = map[string]string{
	"US": "United States", "GB": "United Kingdom", "CA": "Canada", "AU": "Australia",
	"IN": "India", "DE": "Germany", "FR": "France", "NL": "Netherlands", "BR": "Brazil",
	"JP": "Japan", "ES": "Spain", "IT": "Italy", "SE": "Sweden", "NO": "Norway",
	"DK": "Denmark", "FI": "Finland", "PL": "Poland", "IE": "Ireland", "CH": "Switzerland",
	"AT": "Austria", "BE": "Belgium", "PT": "Portugal", "CZ": "Czechia", "ZA": "South Africa",
	"NG": "Nigeria", "KE": "Kenya", "GH": "Ghana", "EG": "Egypt", "AE": "United Arab Emirates",
	"SA": "Saudi Arabia", "IL": "Israel", "TR": "Turkey", "RU": "Russia", "UA": "Ukraine",
	"MX": "Mexico", "AR": "Argentina", "CO": "Colombia", "CL": "Chile", "PE": "Peru",
	"NZ": "New Zealand", "SG": "Singapore", "MY": "Malaysia", "TH": "Thailand", "ID": "Indonesia",
	"PH": "Philippines", "VN": "Vietnam", "KR": "South Korea", "CN": "China", "HK": "Hong Kong",
	"TW": "Taiwan", "PK": "Pakistan", "BD": "Bangladesh", "LK": "Sri Lanka",
}

// CountryName resolves an ISO 3166-1 alpha-2 code to a display name, falling
// back to the code itself for codes outside the common lookup table.
func CountryName(code string) string {
	if name, ok := countryCodes[strings.ToUpper(strings.TrimSpace(code))]; ok {
		return name
	}
	if len(code) == 2 {
		return strings.ToUpper(code)
	}
	return "Unknown"
}
