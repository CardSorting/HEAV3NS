#!/usr/bin/env python3
"""Small, dependency-free bridge for the Hermes Claude subscription plugin.

LUMI intentionally does not vendor the plugin or import its Python package into
Node.  This process loads the user-selected plugin directory, supplies the
small Hermes compatibility surface the transport actually needs, and returns a
single JSON envelope.  Keeping the protocol one-shot makes ownership,
cancellation, and error handling explicit at the Node boundary.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import subprocess
import sys
import types
from typing import Any


MAX_INPUT_BYTES = 128 * 1024 * 1024
MAX_ERROR_CHARS = 8_000
MAX_RUNTIME_DIAGNOSTIC_CHARS = 1_200
EXPECTED_PLUGIN_NAME = "claude-subscription-directsdk-experimental"
REQUIRED_PLUGIN_FILES = (
    "directsdk.py",
    "admission.py",
    "directsdk_setup.py",
    "inert_mcp.py",
    "model_catalog.py",
)


def _redact(text: str) -> str:
    text = re.sub(r"(?i)(sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})", "<redacted>", text)
    return text[:MAX_ERROR_CHARS]


def _strip_nullable_unions(schema: Any, keep_nullable_hint: bool = False) -> Any:
    """Minimal equivalent of Hermes' sanitizer for the plugin's tool path."""
    if isinstance(schema, list):
        return [_strip_nullable_unions(item, keep_nullable_hint) for item in schema]
    if not isinstance(schema, dict):
        return schema

    result = {key: _strip_nullable_unions(value, keep_nullable_hint) for key, value in schema.items()}
    for union_key in ("anyOf", "oneOf"):
        branches = result.get(union_key)
        if not isinstance(branches, list):
            continue
        non_null = [branch for branch in branches if not (isinstance(branch, dict) and branch.get("type") == "null")]
        if len(non_null) == 1:
            result = dict(non_null[0])
            if keep_nullable_hint:
                result["nullable"] = True
        break
    return result


def _clamp_effort(value: Any, supported: tuple[str, ...]) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized in supported:
        return normalized
    if normalized in {"ultra", "very_high", "very-high"} and "max" in supported:
        return "max"
    return None


def _install_hermes_compatibility_shims() -> None:
    """Keep the standalone bridge independent from a Hermes installation."""
    tools_package = types.ModuleType("tools")
    tools_package.__path__ = []  # type: ignore[attr-defined]
    sanitizer = types.ModuleType("tools.schema_sanitizer")
    sanitizer.strip_nullable_unions = _strip_nullable_unions  # type: ignore[attr-defined]
    tools_package.schema_sanitizer = sanitizer  # type: ignore[attr-defined]
    sys.modules["tools"] = tools_package
    sys.modules["tools.schema_sanitizer"] = sanitizer

    agent_package = types.ModuleType("agent")
    agent_package.__path__ = []  # type: ignore[attr-defined]
    reasoning = types.ModuleType("agent.reasoning_effort")
    reasoning.clamp_effort = _clamp_effort  # type: ignore[attr-defined]
    agent_package.reasoning_effort = reasoning  # type: ignore[attr-defined]
    sys.modules["agent"] = agent_package
    sys.modules["agent.reasoning_effort"] = reasoning


def _load_plugin(plugin_dir: Path) -> tuple[Any, Any]:
    if not plugin_dir.is_dir():
        raise ValueError(f"Plugin directory does not exist: {plugin_dir}")
    manifest = plugin_dir / "plugin.yaml"
    if not manifest.is_file() or not re.search(
        rf"^name:\s*{re.escape(EXPECTED_PLUGIN_NAME)}\s*$", manifest.read_text(encoding="utf-8"), re.MULTILINE
    ):
        raise ValueError(f"Plugin manifest is not {EXPECTED_PLUGIN_NAME}: {manifest}")
    missing = [name for name in REQUIRED_PLUGIN_FILES if not (plugin_dir / name).is_file()]
    if missing:
        raise ValueError("Plugin directory is missing required files: " + ", ".join(missing))

    _install_hermes_compatibility_shims()
    sys.path.insert(0, str(plugin_dir))
    spec = importlib.util.spec_from_file_location("lumi_claude_subscription_directsdk", plugin_dir / "directsdk.py")
    if spec is None or spec.loader is None:
        raise ValueError(f"Unable to load plugin transport from {plugin_dir / 'directsdk.py'}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    setup_spec = importlib.util.spec_from_file_location("lumi_claude_subscription_directsdk_setup", plugin_dir / "directsdk_setup.py")
    if setup_spec is None or setup_spec.loader is None:
        raise ValueError(f"Unable to load plugin setup from {plugin_dir / 'directsdk_setup.py'}")
    setup_module = importlib.util.module_from_spec(setup_spec)
    sys.modules[setup_spec.name] = setup_module
    setup_spec.loader.exec_module(setup_module)
    return module, setup_module


def _to_jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump") and callable(value.model_dump):
        return _to_jsonable(value.model_dump())
    if isinstance(value, dict):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _command_argv(command: Any) -> list[str] | None:
    """Normalize configured launchers to argv for every plugin entry point."""
    if isinstance(command, str) and command.strip():
        return shlex.split(command)
    if isinstance(command, (list, tuple)):
        return [str(item) for item in command]
    configured = os.environ.get("CLAUDE_SUBSCRIPTION_DIRECTSDK_COMMAND", "").strip()
    return shlex.split(configured) if configured else None


def _child_env() -> dict[str, str]:
    """Match the plugin's isolated Claude Code environment for a local probe."""
    child = dict(os.environ)
    config = child.pop("CLAUDE_SUBSCRIPTION_DIRECTSDK_CONFIG_DIR", None)
    if config:
        child["CLAUDE_CONFIG_DIR"] = config
    child.update(CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1", DISABLE_TELEMETRY="1", DISABLE_ERROR_REPORTING="1")
    return child


def _resolve_cli(command: Any) -> list[str] | None:
    argv = _command_argv(command) or ["claude"]
    if not argv or not argv[0].strip():
        return None
    head = argv[0]
    executable = head if os.path.isabs(head) and os.access(head, os.X_OK) else shutil.which(head, path=os.environ.get("PATH") or os.defpath)
    return [executable, *argv[1:]] if executable else None


def _probe_auth_runtime(command: Any, timeout: float) -> str | None:
    """Recover launch failures hidden by the plugin's fail-soft setup probe.

    The plugin intentionally treats malformed/non-JSON auth output as logged out
    so setup remains non-blocking.  That is safe for the plugin, but too vague
    for an interactive host: a CLI crash (for example an unsupported Node
    runtime) needs a different recovery instruction than ``auth login``.
    """
    resolved = _resolve_cli(command)
    if resolved is None:
        return None
    try:
        run = subprocess.run(
            resolved + ["auth", "status"],
            env=_child_env(),
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=max(1.0, min(float(timeout), 20.0)),
        )
    except subprocess.TimeoutExpired:
        return "Claude Code auth status timed out. Confirm the CLI can start, then run `claude auth status` manually."
    except OSError as error:
        return f"Claude Code could not start for auth status: {_redact(str(error))}"

    if run.returncode == 0:
        return None
    detail = (run.stderr or run.stdout or "").replace("\x1b", "").strip()
    # Claude Code bundles a large single-line module. Prefer the actionable
    # terminal error and runtime version over dumping that minified line into
    # a TUI/doctor card.
    actionable = re.findall(r"\b(?:TypeError|ReferenceError|SyntaxError|RangeError):\s+[^\n]+|Node\.js\s+v\S+", detail)
    detail = " · ".join(actionable[-3:]) if actionable else re.sub(r"\s+", " ", detail)
    detail = _redact(detail)[:MAX_RUNTIME_DIAGNOSTIC_CHARS]
    suffix = f": {detail}" if detail else ""
    runtime_failure = bool(
        re.search(
            r"Node\.js\s+v|unsupported\s+(?:node|runtime)|cannot read properties of undefined",
            detail,
            re.IGNORECASE,
        )
    )
    recovery = (
        "Verify the CLI's supported Node runtime, then run `claude auth login`."
        if runtime_failure
        else "Run `claude auth login` and retry."
    )
    return f"Claude Code could not complete its local auth check (exit {run.returncode}){suffix}. {recovery}"


def _run(request: dict[str, Any]) -> dict[str, Any]:
    plugin_dir = Path(str(request.get("plugin_dir", ""))).expanduser().resolve()
    plugin, setup = _load_plugin(plugin_dir)
    action = request.get("action", "completion")
    command = _command_argv(request.get("command"))
    setup_command = command
    timeout = request.get("timeout_seconds", 180)
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or timeout <= 0:
        raise ValueError("timeout_seconds must be a positive number")

    if action == "status":
        status = _to_jsonable(setup.setup_status(command=setup_command, env=None, timeout=timeout))
        if isinstance(status, dict) and status.get("available") is True and status.get("logged_in") is not True:
            runtime_detail = _probe_auth_runtime(setup_command, timeout)
            if runtime_detail:
                status["detail"] = runtime_detail
        return {"status": status}
    if action == "models":
        discovered = setup.discover_models(command=setup_command, env=None, timeout=timeout)
        result: dict[str, Any] = {"models": _to_jsonable(discovered or [])}
        if not discovered:
            status = _to_jsonable(setup.setup_status(command=setup_command, env=None, timeout=timeout))
            if isinstance(status, dict) and status.get("available") is True and status.get("logged_in") is not True:
                runtime_detail = _probe_auth_runtime(setup_command, timeout)
                if runtime_detail:
                    status["detail"] = runtime_detail
            if isinstance(status, dict):
                result["status"] = status
        return result
    if action != "completion":
        raise ValueError(f"Unsupported bridge action: {action}")

    body = request.get("request")
    if not isinstance(body, dict):
        raise ValueError("completion request must be an object")

    client = plugin.Client(command=command, timeout=timeout)
    try:
        response = client.chat.completions.create(**body)
        return {"response": _to_jsonable(response)}
    finally:
        client.close()


_active_client: Any = None


def _handle_signal(signum: int, _frame: Any) -> None:
    if _active_client is not None:
        try:
            _active_client.cancel()
        except Exception:
            pass
    raise SystemExit(128 + signum)


def main() -> int:
    global _active_client
    signal.signal(signal.SIGTERM, _handle_signal)
    if hasattr(signal, "SIGINT"):
        signal.signal(signal.SIGINT, _handle_signal)

    raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        envelope = {"ok": False, "error": {"type": "ValueError", "message": "Bridge request is too large"}}
    else:
        try:
            request = json.loads(raw.decode("utf-8"))
            if not isinstance(request, dict):
                raise ValueError("Bridge request must be a JSON object")
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                # _run owns the client lifetime.  The signal handler still has a
                # reference while native generation is active.
                _active_client = None
                if request.get("action", "completion") == "completion":
                    plugin_dir = Path(str(request.get("plugin_dir", ""))).expanduser().resolve()
                    plugin, _ = _load_plugin(plugin_dir)
                    _active_client = plugin.Client(
                        command=_command_argv(request.get("command")), timeout=request.get("timeout_seconds", 180)
                    )
                    body = request.get("request")
                    if not isinstance(body, dict):
                        raise ValueError("completion request must be an object")
                    response = _active_client.chat.completions.create(**body)
                    result = {"response": _to_jsonable(response)}
                    _active_client.close()
                    _active_client = None
                else:
                    result = _run(request)
            envelope = {"ok": True, **result}
        except BaseException as error:
            if isinstance(error, (KeyboardInterrupt, SystemExit)):
                raise
            envelope = {
                "ok": False,
                "error": {"type": type(error).__name__, "message": _redact(str(error) or "Bridge request failed")},
            }
        finally:
            if _active_client is not None:
                try:
                    _active_client.close()
                except Exception:
                    pass
            _active_client = None

    sys.stdout.write(json.dumps(envelope, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
