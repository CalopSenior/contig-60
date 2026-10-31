package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEmbeddedGame(t *testing.T) {
	handler := gameHandler()
	for _, tc := range []struct {
		path, host, method string
		code               int
	}{
		{"/", "localhost:8080", "GET", 200},
		{"/", "evil.example:8080", "GET", 403},
		{"/assets/", "localhost:8080", "GET", 404},
		{"/missing", "localhost:8080", "GET", 404},
		{"/", "localhost:8080", "POST", 405},
	} {
		req := httptest.NewRequest(tc.method, "http://"+tc.host+tc.path, nil)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != tc.code {
			t.Fatalf("%s %s: got %d, want %d", tc.host, tc.path, res.Code, tc.code)
		}
		if tc.code == 200 && !strings.Contains(res.Body.String(), "Contig 60") {
			t.Fatal("Missing game HTML")
		}
	}
}
