package queue

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/hibiken/asynq"
)

type Server struct {
	*asynq.Server
	mux *asynq.ServeMux
}

func NewServer(redisAddr string) *Server {
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
			RetryDelayFunc: func(n int, e error, t *asynq.Task) time.Duration {
				return time.Duration(n*n) * 15 * time.Second
			},
			Logger: asynqLogger{},
		},
	)
	return &Server{Server: srv, mux: asynq.NewServeMux()}
}

func (s *Server) HandleCampaignSend(handler func(ctx context.Context, campaignID string) error) {
	s.mux.HandleFunc(TaskCampaignSend, func(ctx context.Context, t *asynq.Task) error {
		var p CampaignSendPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return handler(ctx, p.CampaignID)
	})
}

func (s *Server) HandleCampaignRecipient(handler func(ctx context.Context, campaignID, contactID string) error) {
	s.mux.HandleFunc(TaskCampaignRecipient, func(ctx context.Context, t *asynq.Task) error {
		var p CampaignRecipientPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return handler(ctx, p.CampaignID, p.ContactID)
	})
}

func (s *Server) HandleRecordEvent(handler func(ctx context.Context, p RecordEventPayload) error) {
	s.mux.HandleFunc(TaskRecordEvent, func(ctx context.Context, t *asynq.Task) error {
		var p RecordEventPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return handler(ctx, p)
	})
}

func (s *Server) HandleImportCSV(handler func(ctx context.Context, p ImportCSVPayload) error) {
	s.mux.HandleFunc(TaskImportCSV, func(ctx context.Context, t *asynq.Task) error {
		var p ImportCSVPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return handler(ctx, p)
	})
}

func (s *Server) HandleEmbedContact(handler func(ctx context.Context, p EmbedContactPayload) error) {
	s.mux.HandleFunc(TaskEmbedContact, func(ctx context.Context, t *asynq.Task) error {
		var p EmbedContactPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return handler(ctx, p)
	})
}

func (s *Server) HandleEmbedWorkspace(handler func(ctx context.Context, p EmbedWorkspacePayload) error) {
	s.mux.HandleFunc(TaskEmbedWorkspace, func(ctx context.Context, t *asynq.Task) error {
		var p EmbedWorkspacePayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return handler(ctx, p)
	})
}

func (s *Server) Start() error {
	return s.Run(s.mux)
}

type asynqLogger struct{}

func (asynqLogger) Debug(args ...any) { log.Println(args...) }
func (asynqLogger) Info(args ...any)  { log.Println(args...) }
func (asynqLogger) Warn(args ...any)  { log.Println(args...) }
func (asynqLogger) Error(args ...any) { log.Println(args...) }
func (asynqLogger) Fatal(args ...any) { log.Fatal(args...) }
