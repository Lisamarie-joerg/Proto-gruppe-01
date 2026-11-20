"""Start the static site on an available loopback port and open it."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


def main():
    webroot = Path(__file__).resolve().parent / "webapp" / "static"
    handler = partial(SimpleHTTPRequestHandler, directory=str(webroot))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"Stockerau – Material und Bewehrung: {url}", flush=True)
        print("Server beenden: Strg+C", flush=True)
        webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
