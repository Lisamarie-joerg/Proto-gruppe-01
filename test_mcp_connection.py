"""Quick test: is the Rhino 8 MCP bridge reachable on localhost:1999?"""
import json
import socket

HOST = "127.0.0.1"
PORT = 1999


def send_command(cmd_type, params=None):
    """Send one JSON command to the Rhino MCP plugin and return the response."""
    with socket.create_connection((HOST, PORT), timeout=5) as sock:
        payload = json.dumps({"type": cmd_type, "params": params or {}})
        sock.sendall(payload.encode("utf-8"))
        chunks = []
        while True:
            data = sock.recv(8192)
            if not data:
                break
            chunks.append(data)
            try:
                return json.loads(b"".join(chunks).decode("utf-8"))
            except json.JSONDecodeError:
                continue  # response not complete yet
    raise RuntimeError("Connection closed without a complete response.")


def main():
    print(f"Testing Rhino MCP bridge at {HOST}:{PORT} ...")
    try:
        response = send_command("get_scene_info")
    except (ConnectionRefusedError, socket.timeout, OSError) as exc:
        print(f"CONNECTION FAILED: {type(exc).__name__}: {exc}")
        print("-> The Rhino plugin is NOT reachable. Check that Rhino 8 is open")
        print("   and the MCP socket server was started inside Rhino.")
        raise SystemExit(1)

    if response.get("status") in ("success", "ok"):
        print("CONNECTION OK - Rhino answered:")
        print(json.dumps(response, indent=2, ensure_ascii=False)[:2000])
    else:
        print("Connected, but Rhino returned an unexpected response:")
        print(json.dumps(response, indent=2, ensure_ascii=False)[:2000])
        raise SystemExit(2)


if __name__ == "__main__":
    main()
