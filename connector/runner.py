"""Outbound HTTPS long-poll connector; one-time pairing credentials stay in RAM."""

import argparse
import contextvars
from concurrent.futures import ThreadPoolExecutor
import getpass
import json
import os
import threading
import time
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from urllib.error import HTTPError
from .runtime import HermesRuntime
from .voice import VoiceManager, VoiceServiceError


class Connector:
    def __init__(self, url, runtime, allow_subscription=False, subscription_broker=None):
        parsed = urlparse(url)
        if parsed.scheme != "https" and not (
            parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")
        ):
            raise ValueError("HTTPS relay required")
        if parsed.username or parsed.password or parsed.path not in ("", "/"):
            raise ValueError("Relay origin only")
        self.url = url.rstrip("/")
        self.token = ""
        self.runtime = runtime
        self.voice = VoiceManager(runtime, allow_subscription, subscription_broker)
        self.stop = threading.Event()
        self.pool = ThreadPoolExecutor(max_workers=8)
        self.results = {}
        self.lock = threading.Lock()
        self.inflight = set()

    def request(self, path, body=None):
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        req = Request(
            self.url + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
        )
        with urlopen(req, timeout=30) as response:
            return json.load(response)

    def pair(self, code):
        result = self.request("/connector/pair", {"code": code})
        self.token = result["token"]

    def run(self):
        def maintain():
            while not self.stop.wait(8):
                self.voice.reap()
                try:
                    self.request(
                        "/connector/heartbeat",
                        {"capabilities": self.voice.capabilities()},
                    )
                except HTTPError as e:
                    if e.code == 401:
                        self.stop.set()
                        self.voice.shutdown()
                except Exception:
                    pass

        self.request(
            "/connector/heartbeat", {"capabilities": self.voice.capabilities()}
        )
        context = contextvars.copy_context()
        threading.Thread(target=lambda: context.run(maintain), daemon=True).start()
        print("Connected. Credentials remain on this host. Ctrl+C to stop.", flush=True)
        try:
            while not self.stop.is_set():
                try:
                    job = self.request("/connector/jobs")
                    if job.get("idle"):
                        continue
                    with self.lock:
                        if len(self.inflight) >= 12:
                            raise RuntimeError("Connector queue full")
                        self.inflight.add(job["id"])
                    self.pool.submit(contextvars.copy_context().run, self.execute, job)
                except HTTPError as e:
                    if e.code == 401:
                        break
                    self.stop.wait(3)
                except Exception:
                    self.stop.wait(3)
        finally:
            self.stop.set()
            self.voice.shutdown()
            self.pool.shutdown(wait=True, cancel_futures=True)
            self.token = ""

    def execute(self, job):
        ident = job["id"]
        try:
            if ident in self.results:
                result = self.results[ident]
            else:
                if job["deadline"] < time.time() * 1000:
                    raise RuntimeError("Expired job")
                kind = job["kind"]
                sid = job["sessionId"]
                payload = job["payload"]
                if kind == "ask":
                    data = self.runtime.ask(sid, payload)
                elif kind == "start":
                    data = self.voice.start(sid, payload)
                elif kind == "close":
                    data = self.voice.close(sid)
                elif kind == "heartbeat":
                    data = self.voice.heartbeat(sid)
                else:
                    raise RuntimeError("Unsupported job")
                result = {"id": ident, "ok": True, "data": data}
        except Exception as error:
            result = {
                "id": ident,
                "ok": False,
                "error": "Connector operation failed; check configured model access and provider account.",
                "errorCode": error.code
                if isinstance(error, VoiceServiceError)
                else "connector_failed",
            }
        self.results[ident] = result
        if len(self.results) > 256:
            self.results.pop(next(iter(self.results)))
        for attempt in range(3):
            try:
                self.request("/connector/result", result)
                break
            except Exception:
                self.stop.wait(1)
        with self.lock:
            self.inflight.discard(ident)


def configure(parser):
    parser.add_argument("--relay", default="http://127.0.0.1:4317")
    parser.add_argument(
        "--allow-subscription",
        action="store_true",
        help="Experimental subscription lane; no paid fallback",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Clearly labelled local test responses; no AI calls",
    )


def main(args=None):
    if args is None:
        parser = argparse.ArgumentParser()
        configure(parser)
        args = parser.parse_args()
    runtime = HermesRuntime(demo=args.demo)
    if not runtime.available():
        raise SystemExit(
            "Hermes plugin LLM access is unavailable. Run this as `hermes consult` with the plugin enabled."
        )
    connector = Connector(args.relay, runtime, args.allow_subscription)
    code = os.environ.pop("CONSULT_PAIR_CODE", None) or getpass.getpass(
        "One-time connection code: "
    )
    try:
        connector.pair(code)
        code = ""
        connector.run()
    except KeyboardInterrupt:
        pass
    except Exception:
        raise SystemExit(
            "Connector failed. Check relay, pairing code and provider configuration."
        )


if __name__ == "__main__":
    main()
