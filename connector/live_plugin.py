"""Load the versioned Hermes Live API from the active profile's installed plugin."""
from pathlib import Path
import importlib.util
import sys
import threading

_lock = threading.Lock()
_modules = {}


class LiveUnavailable(RuntimeError):
    """Raised with an English message; ``code`` is a Desktop locale key."""

    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def load_voice(profile_home):
    # Only the active profile's copy: never borrow another profile's plugin or its login.
    source = Path(profile_home) / 'plugins/hermes-live/dashboard/consultation.py'
    if not source.is_file():
        raise LiveUnavailable(
            'errLive',
            'Install the consultation-enabled Hermes Live plugin in this Hermes profile. '
            'API voice works without it.')
    source = source.resolve()
    with _lock:
        module = _modules.get(source)
        if module is None:
            name = 'hermes_consult_live_' + str(len(_modules))
            spec = importlib.util.spec_from_file_location(name, source)
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
            if getattr(module, 'API_VERSION', None) != 1:
                raise LiveUnavailable('errLiveVersion', 'Unsupported Hermes Live consultation API version.')
            _modules[source] = module
    return module.create_voice()
