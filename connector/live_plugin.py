"""Load the versioned Hermes Live API from the provider's installed plugin."""
from pathlib import Path
import importlib.util
import sys
import threading

_lock = threading.Lock()
_modules = {}

def load_voice(profile_home):
    from hermes_constants import get_default_hermes_root
    candidates = [Path(profile_home) / 'plugins/hermes-live/dashboard/consultation.py',
                  get_default_hermes_root() / 'plugins/hermes-live/dashboard/consultation.py']
    source = next((p.resolve() for p in candidates if p.is_file()), None)
    if source is None:
        raise RuntimeError('Hermes Live의 상담 연동 버전을 설치하세요. 공식 API는 이 플러그인 없이 사용할 수 있습니다.')
    with _lock:
        module = _modules.get(source)
        if module is None:
            name = 'hermes_consult_live_' + str(len(_modules))
            spec = importlib.util.spec_from_file_location(name, source)
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            spec.loader.exec_module(module)
            if module.API_VERSION != 1: raise RuntimeError('지원되지 않는 Hermes Live 상담 API 버전입니다.')
            _modules[source] = module
    return module.create_voice()
