"""Desktop-authenticated control plane. The public Node listener never receives keys."""
from __future__ import annotations
import atexit
import importlib.util
import importlib
import contextvars
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
# Private module namespace prevents collisions with other plugins and stale CLI imports.
_namespace = __name__ + "_runtime_" + secrets.token_hex(4)
_spec = importlib.util.spec_from_file_location(_namespace, ROOT / "connector/__init__.py", submodule_search_locations=[str(ROOT / "connector")])
_package = importlib.util.module_from_spec(_spec)
sys.modules[_namespace] = _package
_spec.loader.exec_module(_package)
Connector = importlib.import_module(_namespace + ".runner").Connector
HermesRuntime = importlib.import_module(_namespace + ".runtime").HermesRuntime
_live = importlib.import_module(_namespace + ".live_plugin")
load_voice, LiveUnavailable = _live.load_voice, _live.LiveUnavailable
host_llm = importlib.import_module(_namespace + ".runtime").host_llm

router = APIRouter()


def failure(status, key, message):
    """English detail prefixed with a Desktop locale key (``HC:<key>``) the panel translates."""
    return HTTPException(status, f"HC:{key} {message}")


# Relay (Node) admin failures are reduced to status-based English messages; its text never surfaces.
RELAY_ERRORS = {
    400: ("errInput", "Check the highlighted values and try again."),
    401: ("errBackend", "The consultation server rejected the Desktop session. Restart the server."),
    403: ("errBackend", "The consultation server rejected the Desktop session. Restart the server."),
    404: ("errNotFound", "The assistant was not found. Refresh and try again."),
    409: ("errConflict", "The request conflicts with the current state, such as the assistant limit. Refresh and try again."),
    429: ("errLimit", "A usage limit was reached. Wait before trying again."),
}

class Start(BaseModel):
    publicOrigin: str = Field(max_length=250)
    port: int = Field(default=4318, ge=1024, le=65535)
    subscription: bool = False

class Control(BaseModel):
    path: str
    method: str = "GET"
    body: dict | None = None

class Service:
    def __init__(self, home):
        self.home = home
        self.process = None
        self.token = ""
        self.base = ""
        self.origin = ""
        self.subscription = False
        self.connectors = {}
        self.lock = threading.RLock()
        self.watching = threading.Event()
        try:
            saved = Start.model_validate_json((home / "consult/settings.json").read_text())
            self.origin = saved.publicOrigin
            self.base = f"http://127.0.0.1:{saved.port}"
            self.subscription = saved.subscription
        except (OSError, ValueError):
            pass

    def request(self, path, method="GET", body=None):
        request = Request(self.base + path, method=method,
            headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
            data=json.dumps(body).encode() if body is not None else None)
        try:
            with urlopen(request, timeout=10) as response:
                return json.load(response)
        except HTTPError as error:
            error.close()
            key, message = RELAY_ERRORS.get(error.code, ("errGeneric", "The consultation server could not complete the request."))
            raise failure(error.code, key, message) from None

    def status(self):
        return {"running": self.process is not None and self.process.poll() is None,
                "publicOrigin": self.origin, "subscription": self.subscription,
                "port": int(self.base.rsplit(":", 1)[-1]) if self.base else 4318}

    def start(self, config):
        with self.lock:
            if self.status()["running"]:
                return self.status()
            parsed = urlparse(config.publicOrigin)
            if (parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost"))) or parsed.netloc == "" or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
                raise failure(400, "errOrigin", "Enter a public HTTPS origin without a path.")
            node = shutil.which("node")
            if not node or not (ROOT / "dist/server.mjs").exists():
                raise failure(503, "errRuntime", "Node.js 24 or later and a built plugin are required. For development installs run npm ci, then npm run build.")
            # Never adopt an unrelated listener or send its process our private admin token.
            with socket.socket() as probe:
                try: probe.bind(("127.0.0.1", config.port))
                except OSError: raise failure(409, "errPort", "This port is already in use. Choose another port.") from None
            self.token = secrets.token_urlsafe(32)
            self.origin = config.publicOrigin
            self.base = f"http://127.0.0.1:{config.port}"
            self.subscription = config.subscription
            data = self.home / "consult"
            data.mkdir(parents=True, exist_ok=True, mode=0o700)
            env = {key: os.environ[key] for key in ("PATH", "HOME", "SYSTEMROOT") if key in os.environ}
            env.update(PORT=str(config.port), HOST="127.0.0.1", PUBLIC_ORIGIN=self.origin,
                DB_PATH=str(data / "consult.sqlite"), CONSULT_DESKTOP_TOKEN=self.token, CONSULT_PARENT_PID=str(os.getpid()))
            from agent.secret_scope import get_secret
            challenge_secret = get_secret("HERMES_CONSULT_TURNSTILE_SECRET")
            if challenge_secret:
                env["HERMES_CONSULT_TURNSTILE_SECRET"] = challenge_secret
            self.process = subprocess.Popen([node, "--experimental-strip-types", "dist/server.mjs"], cwd=ROOT, env=env,
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(80):
                    if self.process.poll() is not None: break
                    try:
                        self.request("/api/sites")
                    except (OSError, HTTPException):
                        time.sleep(.1)
                        continue
                    # Configuration errors (missing LLM access, Hermes Live) surface as-is.
                    self.sync()
                    settings_file = data / "settings.json"
                    settings_file.write_text(config.model_dump_json())
                    settings_file.chmod(0o600)
                    self.watching = threading.Event()
                    stopped = self.watching
                    context = contextvars.copy_context()
                    def watch():
                        while not stopped.wait(10):
                            with self.lock:
                                if stopped.is_set() or not self.status()["running"]: return
                                try: self.sync()
                                except Exception: pass
                    threading.Thread(target=lambda: context.run(watch), daemon=True).start()
                    return self.status()
                raise failure(503, "errStart", "The consultation server did not start. Check the Node.js version and installation.")
            except Exception:
                self.stop()
                raise

    def sync(self):
        for site in self.request("/api/sites"):
            existing = self.connectors.get(site["id"])
            if existing and existing[1].is_alive(): continue
            if not site["published"]: continue
            runtime = HermesRuntime(host_llm(ROOT))
            if not runtime.available():
                raise failure(503, "errLlm", "Hermes plugin LLM access is unavailable. Enable the plugin and restart Hermes.")
            try:
                broker = load_voice(self.home) if self.subscription else None
            except LiveUnavailable as error:
                raise failure(409, error.code, str(error)) from None
            connector = Connector(self.base, runtime, self.subscription, broker)
            try:
                code = self.request(f'/api/sites/{site["id"]}/pair', "POST", {})["code"]
                connector.pair(code)
                context = contextvars.copy_context()
                thread = threading.Thread(target=lambda c=connector, ctx=context: ctx.run(c.run), daemon=True)
                self.connectors[site["id"]] = (connector, thread)
                thread.start()
            except Exception:
                connector.stop.set()
                connector.voice.shutdown()
                connector.pool.shutdown(wait=False, cancel_futures=True)
                raise

    def stop(self):
        with self.lock:
            self.watching.set()
            for connector, thread in self.connectors.values():
                connector.stop.set()
                connector.voice.shutdown()
            if self.process and self.process.poll() is None:
                self.process.terminate()
                try: self.process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=5)
            for connector, thread in self.connectors.values(): thread.join(timeout=2)
            self.connectors.clear()
            self.process = None
            self.token = ""
            return self.status()

services = {}
services_lock = threading.Lock()
def service():
    from hermes_constants import get_hermes_home
    home = get_hermes_home().resolve()
    with services_lock:
        if home not in services: services[home] = Service(home)
        return services[home]

def shutdown():
    for item in list(services.values()): item.stop()
atexit.register(shutdown)

@router.get('/status')
def status(): return service().status()

@router.post('/start')
def start(config: Start): return service().start(config)

@router.post('/stop')
def stop(): return service().stop()

@router.post('/control')
def control(command: Control):
    if not re.fullmatch(r'/api/sites(?:/site_[A-Za-z0-9_-]+(?:/(?:publish|activity))?)?', command.path) or command.method not in ("GET", "POST", "PUT"):
        raise failure(400, "errInput", "This management request is not allowed.")
    item = service()
    with item.lock:
        if not item.status()["running"]: raise failure(409, "errNotRunning", "Start the consultation server first.")
        result = item.request(command.path, command.method, command.body)
        if command.path.endswith('/publish'): item.sync()
        return result
