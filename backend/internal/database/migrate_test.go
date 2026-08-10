package database

import (
	"sort"
	"strings"
	"testing"
)

// TestMySQLMigrationsExcludesPostgres guards against the hardcoded-registry
// regression where a Postgres migration leaked into the MySQL run.
func TestMySQLMigrationsExcludesPostgres(t *testing.T) {
	migs, err := mysqlMigrations()
	if err != nil {
		t.Fatalf("mysqlMigrations: %v", err)
	}
	for _, name := range migs {
		if strings.Contains(name, "0003_") || strings.Contains(name, "0004_") || strings.Contains(name, "0005_") {
			t.Errorf("postgres migration %s leaked into mysql list", name)
		}
	}
}

// TestMySQLMigrationsSortedAndComplete ensures auto-discovery returns every
// non-postgres migration file, in filename order.
func TestMySQLMigrationsSortedAndComplete(t *testing.T) {
	migs, err := mysqlMigrations()
	if err != nil {
		t.Fatalf("mysqlMigrations: %v", err)
	}
	if !sort.StringsAreSorted(migs) {
		t.Errorf("migrations not sorted: %v", migs)
	}
	if len(migs) == 0 {
		t.Fatal("no mysql migrations found")
	}
	if migs[0] != "migrations/0001_init.sql" {
		t.Errorf("expected 0001_init first, got %q", migs[0])
	}
	seen := map[string]bool{}
	for _, m := range migs {
		if seen[m] {
			t.Errorf("duplicate migration %s", m)
		}
		seen[m] = true
		if _, err := migrationsFS.ReadFile(m); err != nil {
			t.Errorf("migration %s unreadable: %v", m, err)
		}
	}
}
