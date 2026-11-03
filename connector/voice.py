"""Voice engines run on provider host. No automatic API fallback."""

import json
import os
import threading
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote
from uuid import uuid4
from .vendor import codex_broker


def voice_prompt(config):
    return (
        "You are " + str(config.get("name", "AI 상담원")) + ". Speak concise Korean. "
        "You are an AI business consultation assistant. The visitor is already on this business website. "
        "Assume questions refer to this business; do not ask which company. Greet the visitor: "
        + str(config.get("greeting", "안녕하세요. 무엇을 도와드릴까요?"))
        + ". Delegate ALL business-specific facts, policies and service questions to the client backend before answering. "
        "The backend can only answer from published consultation documents; it cannot execute actions. "
        "Never claim access to private files, purchases, calendars or tools. Never invent business facts. "
        "If information is unavailable, suggest the contact form. Never claim a form was submitted. "
        "Do not reveal private configuration. Provider rules: "
        + str(config.get("rules", ""))
    )


def api_request(offer, config):
    return {
        "session": {
            "model": "gpt-live-1",
            "instructions": voice_prompt(config),
            "delegation": {"type": "client"},
        },
        "transport": {"type": "webrtc", "sdp": offer},
    }


def get_key():
    try:
        from agent.secret_scope import get_secret

        return (
            get_secret("HERMES_CONSULT_OPENAI_API_KEY")
            or get_secret("OPENAI_API_KEY")
            or ""
        )
    except ImportError:
        return os.environ.get("HERMES_CONSULT_OPENAI_API_KEY") or os.environ.get(
            "OPENAI_API_KEY", ""
        )


class VoiceServiceError(RuntimeError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def classify_api_error(error):
    if error.code == 429:
        return VoiceServiceError("voice_quota")
    if error.code in (401, 403):
        return VoiceServiceError("voice_auth")
    return VoiceServiceError("voice_unavailable")


class LiveAPI:
    def __init__(self, session_id, payload, runtime):
        self.local_id = session_id
        self.payload = payload
        self.runtime = runtime
        self.lifecycle = threading.Lock()
        self.socket = None
        self.closed = threading.Event()
        self.stopping = False
        self.transcript = []
        self.seen = set()
        self.busy = threading.Lock()
        self.send_lock = threading.Lock()

    def start(self):
        import websocket

        key = get_key()
        if not key:
            raise RuntimeError("OpenAI API 키가 설정되지 않았습니다.")
        request = Request(
            "https://api.openai.com/v1/live/sessions",
            data=json.dumps(
                api_request(self.payload["offer"], self.payload["config"])
            ).encode(),
            headers={
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=35) as response:
                result = json.load(response)
        except HTTPError as error:
            classified = classify_api_error(error)
            error.close()
            raise classified from None
        self.upstream_id = result["session"]["id"]

        def attach():
            return websocket.create_connection(
                "wss://api.openai.com/v1/live/sessions/"
                + quote(self.upstream_id, safe="")
                + "/attach",
                header={"Authorization": "Bearer " + key},
                timeout=10,
                enable_multithread=True,
            )

        try:
            socket = attach()
        except Exception:
            # The upstream POST may have succeeded. Retry attachment only to close,
            # never create a second session or return an unusable answer to the browser.
            cleanup = None
            try:
                cleanup = attach()
                cleanup.send(
                    json.dumps({"type": "session.close", "event_id": str(uuid4())})
                )
            except Exception:
                pass  # A network partition cannot confirm upstream final usage.
            finally:
                if cleanup:
                    cleanup.close()
            raise RuntimeError(
                "Voice attachment failed; final usage may be unconfirmed"
            ) from None
        with self.lifecycle:
            self.socket = socket
            if self.stopping:
                try:
                    socket.send(
                        json.dumps({"type": "session.close", "event_id": str(uuid4())})
                    )
                finally:
                    socket.close()
                raise RuntimeError("Cancelled during start")
        threading.Thread(target=self.listen, daemon=True).start()
        return {"answer": result["transport"]["sdp"], "engine": "api"}

    def send(self, event):
        if self.socket:
            with self.send_lock:
                self.socket.send(json.dumps({"event_id": str(uuid4()), **event}))

    def listen(self):
        import websocket

        socket = self.socket
        try:
            while not self.closed.is_set():
                try:
                    raw = socket.recv()
                except websocket.WebSocketTimeoutException:
                    continue
                if not raw:
                    break
                event = json.loads(raw)
                kind = event.get("type", "")
                if kind == "session.closed":
                    self.closed.set()
                    break
                if kind in (
                    "session.input_transcript.delta",
                    "session.output_transcript.delta",
                ):
                    role = (
                        "user"
                        if kind == "session.input_transcript.delta"
                        else "assistant"
                    )
                    self.transcript.append(
                        {"role": role, "text": str(event.get("delta", ""))[:2000]}
                    )
                    self.transcript = self.transcript[-80:]
                if kind == "session.delegation.created":
                    d = event.get("delegation", {})
                    ident = d.get("id")
                    if (
                        d.get("target") == "client"
                        and ident
                        and ident not in self.seen
                        and len(self.seen) < 30
                    ):
                        self.seen.add(ident)
                        threading.Thread(
                            target=self.delegate, args=(ident,), daemon=True
                        ).start()
        except Exception:
            pass
        finally:
            self.closed.set()

    def delegate(self, ident):
        if not self.busy.acquire(blocking=False):
            return
        try:
            self.send(
                {
                    "type": "session.thinking.append",
                    "delegation_id": ident,
                    "content": "상담 자료를 확인하고 있습니다.",
                }
            )
            snapshot = self.transcript[-30:]
            text = "\n".join(m["role"] + ": " + m["text"] for m in snapshot)[-4000:]
            answer = self.runtime.ask(
                self.local_id,
                {
                    **self.payload,
                    "text": text or "방문자에게 질문을 다시 확인하세요.",
                    "history": [],
                },
            )["text"]
            if not self.closed.is_set() and not self.stopping:
                self.send(
                    {
                        "type": "session.commentary.append",
                        "delegation_id": ident,
                        "content": answer[:1000],
                    }
                )
        except Exception:
            if not self.closed.is_set():
                try:
                    self.send(
                        {
                            "type": "session.commentary.append",
                            "delegation_id": ident,
                            "content": "자료 조회에 실패했습니다. 문의 남기기를 안내하세요.",
                        }
                    )
                except Exception:
                    pass
        finally:
            self.busy.release()

    def close(self):
        with self.lifecycle:
            self.stopping = True
            socket = self.socket
            self.socket = None
        if socket:
            try:
                with self.send_lock:
                    socket.send(
                        json.dumps({"type": "session.close", "event_id": str(uuid4())})
                    )
                self.closed.wait(5)
            except Exception:
                pass
            socket.close()
        self.closed.set()


class VoiceManager:
    def __init__(self, runtime, allow_subscription=False, subscription_broker=None):
        self.runtime = runtime
        self.broker = subscription_broker or codex_broker
        self.allow_subscription = allow_subscription
        self.subscription_ready = (
            self.broker.readiness()["available"] if allow_subscription else False
        )
        self.calls = {}
        self.cancelled = {}
        self.lock = threading.RLock()

    def capabilities(self):
        import importlib.util

        if self.runtime.demo:
            return {"api": False, "subscription": False, "hermes": True, "demo": True}
        return {
            "api": bool(get_key())
            and importlib.util.find_spec("websocket") is not None,
            "subscription": self.allow_subscription and self.subscription_ready,
            "hermes": self.runtime.available(),
            "demo": self.runtime.demo,
        }

    def start(self, ident, payload):
        with self.lock:
            if ident in self.calls or ident in self.cancelled:
                raise RuntimeError("Duplicate/closed call")
            if len(self.calls) >= 5:
                raise RuntimeError("Concurrent call limit")
            engine = payload["config"]["engine"]
            call = {
                "engine": engine,
                "expires": min(payload["expiresAt"] / 1000, time.time() + 600),
                "lease": time.time() + 100,
                "api": None,
            }
            self.calls[ident] = call
        try:
            if engine == "subscription":
                if not self.allow_subscription:
                    raise RuntimeError("구독 연결은 명시적으로 활성화해야 합니다.")
                result = self.broker.sessions.start(
                    ident,
                    "cove",
                    payload["offer"],
                    persona=voice_prompt(payload["config"]),
                )
                result = {"answer": result["answer"], "engine": "subscription"}
            elif engine == "api":
                client = LiveAPI(ident, payload, self.runtime)
                call["api"] = client
                result = client.start()
            else:
                raise RuntimeError("Unsupported engine")
            with self.lock:
                if ident not in self.calls or ident in self.cancelled:
                    if call["api"]:
                        call["api"].close()
                    self.broker.sessions.stop(ident)
                    raise RuntimeError("Cancelled during start")
                call["lease"] = time.time() + 40
            return result
        except Exception:
            self.close(ident)
            raise

    def heartbeat(self, ident):
        with self.lock:
            call = self.calls.get(ident)
            if not call or call["expires"] < time.time():
                raise RuntimeError("Call expired")
            call["lease"] = time.time() + 40
            if call["engine"] == "subscription":
                self.broker.sessions.heartbeat(ident)
            elif call["api"] and call["api"].closed.is_set():
                raise RuntimeError("Voice disconnected")
        return {"ok": True}

    def close(self, ident):
        with self.lock:
            call = self.calls.pop(ident, None)
            self.cancelled[ident] = time.time() + 900
        if call:
            if call["api"]:
                call["api"].close()
            if call["engine"] == "subscription":
                self.broker.sessions.stop(ident)
        return {"ok": True}

    def reap(self):
        with self.lock:
            ids = [
                i
                for i, c in self.calls.items()
                if min(c["expires"], c["lease"]) < time.time()
            ]
            self.cancelled = {
                i: expiry
                for i, expiry in self.cancelled.items()
                if expiry > time.time()
            }
        for ident in ids:
            self.close(ident)

    def shutdown(self):
        for ident in list(self.calls):
            self.close(ident)
