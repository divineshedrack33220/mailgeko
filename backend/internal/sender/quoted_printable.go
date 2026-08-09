package sender

import (
	"bytes"
)

const hexDigits = "0123456789ABCDEF"

// quotePrintable encodes data using the quoted-printable transfer encoding so
// non-ASCII characters survive transit through SMTP (which is 7-bit).
func quotePrintable(data string) string {
	if !needsQPCoding(data) {
		return data
	}
	var buf bytes.Buffer
	lineLen := 0
	for i := 0; i < len(data); i++ {
		c := data[i]
		if c == '\r' || c == '\n' {
			buf.WriteByte(c)
			lineLen = 0
			continue
		}
		encoded := false
		if c == '=' || c < 32 || c > 126 {
			buf.WriteByte('=')
			buf.WriteByte(hexDigits[c>>4])
			buf.WriteByte(hexDigits[c&0x0f])
			encoded = true
		} else {
			buf.WriteByte(c)
		}
		lineLen += 3
		if !encoded {
			lineLen = lineLen - 3 + 1
		}
		if lineLen >= 73 {
			buf.WriteString("=\r\n")
			lineLen = 0
		}
	}
	return buf.String()
}

func needsQPCoding(data string) bool {
	for i := 0; i < len(data); i++ {
		c := data[i]
		if c == '=' || c < 32 || c > 126 {
			return true
		}
	}
	return false
}
