// Contig 60 embeds the built TypeScript application into one native executable.
package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"time"
)

//go:embed web
var assets embed.FS

func gameHandler() http.Handler {
	files, err := fs.Sub(assets, "web")
	if err != nil {
		panic(err)
	}
	server := http.FileServer(http.FS(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.Host)
		if err != nil || (host != "localhost" && host != "127.0.0.1") {
			http.Error(w, "Host invalido", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "Metodo nao permitido", http.StatusMethodNotAllowed)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		info, err := fs.Stat(files, path)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-cache")
		server.ServeHTTP(w, r)
	})
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Run()
}

func main() {
	port := flag.Int("port", 0, "Porta local (0 escolhe uma porta livre)")
	noBrowser := flag.Bool("no-browser", false, "Nao abrir o navegador automaticamente")
	flag.Parse()
	if *port < 0 || *port > 65535 {
		log.Fatal("Porta invalida")
	}
	listener, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		log.Fatal(err)
	}
	url := fmt.Sprintf("http://localhost:%d/", listener.Addr().(*net.TCPAddr).Port)
	server := &http.Server{Handler: gameHandler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	fmt.Printf("Contig 60\n%s\nMantenha esta janela aberta. Para encerrar, pressione Ctrl+C ou feche a janela.\n", url)
	if !*noBrowser {
		go func() {
			if err := openBrowser(url); err != nil {
				fmt.Printf("Abra o endereco acima no navegador: %v\n", err)
			}
		}()
	}
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
