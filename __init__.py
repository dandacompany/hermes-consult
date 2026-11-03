"""Hermes plugin entry point. No changes to hermes-live or core required."""

import sys
from pathlib import Path


def register(ctx):
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
        target = Path(root) / "dashboard" / "plugin_api.py"
        for module in list(sys.modules.values()):
            source = getattr(module, "__file__", None)
            if source and Path(source).resolve() == target:
                module.shutdown()
    ctx.on_unload(shutdown)
