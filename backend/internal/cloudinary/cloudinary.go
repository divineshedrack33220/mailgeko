package cloudinary

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"
)

// Client uploads images to Cloudinary using the signed upload API (no SDK).
type Client struct {
	CloudName string
	APIKey    string
	APISecret string
	Folder    string
}

func New(cloudName, apiKey, apiSecret, folder string) *Client {
	return &Client{CloudName: cloudName, APIKey: apiKey, APISecret: apiSecret, Folder: folder}
}

func (c *Client) Enabled() bool {
	return c.CloudName != "" && c.APIKey != "" && c.APISecret != ""
}

// Upload streams a multipart file to Cloudinary and returns the secure URL.
func (c *Client) Upload(file multipart.File, filename string) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("cloudinary is not configured")
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := c.sign("folder=" + c.Folder + "&timestamp=" + timestamp)

	// Build the whole multipart body in memory. Streamed (chunked) requests
	// are rejected by Cloudinary as unsigned uploads, so the body must carry a
	// Content-Length, which net/http only sets for bounded readers.
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("api_key", c.APIKey)
	_ = mw.WriteField("timestamp", timestamp)
	_ = mw.WriteField("folder", c.Folder)
	_ = mw.WriteField("signature", signature)
	part, err := mw.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, file); err != nil {
		return "", err
	}
	_ = mw.Close()

	req, err := http.NewRequest(http.MethodPost,
		fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", c.CloudName), &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("cloudinary upload: %w", err)
	}
	defer resp.Body.Close()

	var out struct {
		SecureURL string `json:"secure_url"`
		Error     struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("cloudinary upload: decode: %w", err)
	}
	if resp.StatusCode != http.StatusOK || out.SecureURL == "" {
		return "", fmt.Errorf("cloudinary upload: status %d: %s", resp.StatusCode, out.Error.Message)
	}
	return out.SecureURL, nil
}

func (c *Client) sign(params string) string {
	h := sha1.Sum([]byte(params + c.APISecret))
	return hex.EncodeToString(h[:])
}
