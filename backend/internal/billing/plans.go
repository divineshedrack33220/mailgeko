package billing

import "errors"

var ErrUnknownPlan = errors.New("unknown plan")

type Plan struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	PriceMonthly   int      `json:"priceMonthly"`
	EmailsPerMonth int      `json:"emailsPerMonth"`
	MaxContacts    int      `json:"maxContacts"`
	MaxUsers       int      `json:"maxUsers"`
	Features       []string `json:"features"`
}

var Plans = []Plan{
	{
		ID: "starter", Name: "Starter", PriceMonthly: 19,
		EmailsPerMonth: 10000, MaxContacts: 2000, MaxUsers: 1,
		Features: []string{"1 user included", "2,000 contacts", "10,000 emails/mo", "Basic reports", "Email support"},
	},
	{
		ID: "growth", Name: "Growth", PriceMonthly: 49,
		EmailsPerMonth: 50000, MaxContacts: 10000, MaxUsers: 3,
		Features: []string{"3 users included", "10,000 contacts", "50,000 emails/mo", "Advanced reports", "Automations", "Priority support"},
	},
	{
		ID: "scale", Name: "Scale", PriceMonthly: 129,
		EmailsPerMonth: 250000, MaxContacts: 50000, MaxUsers: 10,
		Features: []string{"10 users included", "50,000 contacts", "250,000 emails/mo", "AI Studio suite", "Dedicated manager"},
	},
}

func PlanByID(id string) (*Plan, bool) {
	for i := range Plans {
		if Plans[i].ID == id {
			return &Plans[i], true
		}
	}
	return nil, false
}

func DefaultPlanID() string { return Plans[0].ID }

type Usage struct {
	Contacts        int64 `json:"contacts"`
	EmailsThisMonth int64 `json:"emailsThisMonth"`
}

type Limits struct {
	Plan              string `json:"plan"`
	PlanName          string `json:"planName"`
	MaxContacts       int    `json:"maxContacts"`
	MaxEmailsPerMonth int    `json:"maxEmailsPerMonth"`
	Contacts          int64  `json:"contacts"`
	EmailsThisMonth   int64  `json:"emailsThisMonth"`
	ContactsExceeded  bool   `json:"contactsExceeded"`
	EmailsExceeded    bool   `json:"emailsExceeded"`
}

type LimitError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Usage   Usage  `json:"usage"`
	Max     int64  `json:"max"`
}

func (e *LimitError) Error() string { return e.Message }

func limitsFor(planID string, usage Usage) (Limits, error) {
	p, ok := PlanByID(planID)
	if !ok {
		p = &Plans[0]
	}
	l := Limits{
		Plan: p.ID, PlanName: p.Name,
		MaxContacts: p.MaxContacts, MaxEmailsPerMonth: p.EmailsPerMonth,
		Contacts: usage.Contacts, EmailsThisMonth: usage.EmailsThisMonth,
	}
	l.ContactsExceeded = l.Contacts >= int64(p.MaxContacts)
	l.EmailsExceeded = l.EmailsThisMonth >= int64(p.EmailsPerMonth)
	return l, nil
}

func contactLimitError(usage Usage, max int64) *LimitError {
	return &LimitError{
		Code:    "contact_limit",
		Message: "Your plan's contact limit has been reached. Upgrade to add more contacts.",
		Usage:   usage, Max: max,
	}
}

func emailLimitError(usage Usage, max int64) *LimitError {
	return &LimitError{
		Code:    "email_limit",
		Message: "Your plan's monthly email limit has been reached. Upgrade to send more.",
		Usage:   usage, Max: max,
	}
}
