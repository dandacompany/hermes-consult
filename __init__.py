"""Hermes plugin entry point. No changes to hermes-live or core required."""

import sys
from pathlib import Path

# Set by register(): the plugin context whose ``ctx.llm`` facade answers consultations.
# Resolved lazily — probe/validation contexts do not provide ``llm``.
_hermes_consult_ctx = None


def register(ctx):
    global _hermes_consult_ctx
    _hermes_consult_ctx = ctx
    root = str(Path(__file__).resolve().parent)
    if root not in sys.path:
        sys.path.insert(0, root)
    from connector.runner import configure, main

    ctx.register_cli_command(
        name="consult",
        help="Connect a consultation site using outbound HTTPS",
        setup_fn=configure,
        handler_fn=main,
    )

    def shutdown():
        global _hermes_consult_ctx
        _hermes_consult_ctx = None
        target = Path(root) / "dashboard" / "plugin_api.py"
        for module in list(sys.modules.values()):
            source = getattr(module, "__file__", None)
            if source and Path(source).resolve() == target:
                module.shutdown()
    ctx.on_unload(shutdown)
