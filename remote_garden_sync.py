"""
Push campo resonante state from local app_server to remote garden mirror.

Configure via .env (not committed):
  REMOTE_GARDEN_ENABLED=1
  REMOTE_GARDEN_HOST=donecenter.net
  REMOTE_GARDEN_PORT=9040
  REMOTE_GARDEN_SYNC_KEY=optional-shared-secret
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path


_ROOT = Path(__file__).resolve().parent
_ENV_CACHE: dict[str, str] | None = None
_SYNC_LOCK = threading.Lock()
_SYNC_PENDING = False
_SYNC_TIMER: threading.Timer | None = None
_DEBOUNCE_SECONDS = 1.5


def _load_env() -> dict[str, str]:
    global _ENV_CACHE
    if _ENV_CACHE is not None:
        return _ENV_CACHE

    merged = dict(os.environ)
    env_path = _ROOT / '.env'
    if env_path.is_file():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            merged[key.strip()] = value.strip().strip('"').strip("'")
    _ENV_CACHE = merged
    return merged


def _is_enabled() -> bool:
    env = _load_env()
    flag = str(env.get('REMOTE_GARDEN_ENABLED', '')).strip().lower()
    return flag in {'1', 'true', 'yes', 'on'}


def _remote_base_url() -> str | None:
    env = _load_env()
    host = str(env.get('REMOTE_GARDEN_HOST', '')).strip()
    port = str(env.get('REMOTE_GARDEN_PORT', '')).strip()
    if not host or not port:
        return None
    return f'http://{host}:{port}'


def _sync_key() -> str:
    return str(_load_env().get('REMOTE_GARDEN_SYNC_KEY', '')).strip()


def build_sync_payload() -> dict:
    from app_server import load_capture_index, resolve_capture_file

    index = load_capture_index()
    profiles_map = index['profiles']
    profiles = []
    filenames_needed: set[str] = set()

    for prof in profiles_map.values():
        caps = prof['captures']
        caps_sorted = sorted(caps, key=lambda c: c.get('capture_timestamp', ''), reverse=True)
        latest = caps_sorted[0] if caps_sorted else {}
        states = list({c.get('user_state', '') for c in caps if c.get('user_state')})
        total_samples = sum(c.get('total_samples', 0) for c in caps)
        rep = next((c for c in caps_sorted if (c.get('total_samples') or 0) > 0), caps_sorted[0] if caps_sorted else {})

        from app_server import normalize_profile_name

        slug = re.sub(r'[^a-z0-9]+', '-', normalize_profile_name(prof['profile_name'])).strip('-')
        profile_entry = {
            'profile_name': prof['profile_name'],
            'slug': slug,
            'capture_count': len(caps),
            'latest_capture_filename': latest.get('filename', ''),
            'latest_capture_timestamp': latest.get('capture_timestamp', ''),
            'states': states,
            'total_samples': total_samples,
            'captures': caps_sorted,
            'representative': {
                'filename': rep.get('filename', ''),
                'duration_seconds': rep.get('duration_seconds', 0),
                'sample_rate_hz': rep.get('sample_rate_hz', 0),
            },
        }
        profiles.append(profile_entry)

        for cap in caps_sorted:
            fn = cap.get('filename')
            if fn:
                filenames_needed.add(fn)

    profiles.sort(key=lambda p: p.get('latest_capture_timestamp', ''), reverse=True)

    captures: dict[str, dict] = {}
    for filename in filenames_needed:
        filepath = resolve_capture_file(filename)
        if not filepath:
            continue
        try:
            captures[filename] = json.loads(filepath.read_text(encoding='utf-8'))
        except Exception:
            continue

    return {
        'profiles': profiles,
        'captures': captures,
        'synced_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'sync_token': f'{len(profiles)}:{len(captures)}:{int(time.time())}',
    }


def sync_remote_garden_now() -> bool:
    if not _is_enabled():
        return False

    base_url = _remote_base_url()
    if not base_url:
        print('⚠️ Remote garden sync: falta REMOTE_GARDEN_HOST o REMOTE_GARDEN_PORT en .env')
        return False

    try:
        payload = build_sync_payload()
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(
            f'{base_url}/api/sync',
            data=body,
            method='POST',
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': str(len(body)),
            },
        )
        sync_key = _sync_key()
        if sync_key:
            req.add_header('X-Garden-Sync-Key', sync_key)

        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('ok'):
                print(
                    f'☁️ Campo resonante sincronizado → {base_url} '
                    f'({len(payload["profiles"])} perfiles, {len(payload["captures"])} capturas)'
                )
                return True
            print(f'⚠️ Remote garden sync rechazado: {result.get("error", "error desconocido")}')
            return False
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')
        print(f'⚠️ Remote garden sync HTTP {exc.code}: {detail[:240]}')
        return False
    except Exception as exc:
        print(f'⚠️ Remote garden sync falló: {exc}')
        traceback.print_exc()
        return False


def _run_debounced_sync():
    global _SYNC_PENDING, _SYNC_TIMER
    with _SYNC_LOCK:
        _SYNC_PENDING = False
        _SYNC_TIMER = None
    sync_remote_garden_now()


def schedule_remote_garden_sync():
    """Debounce background sync after local capture/garden mutations."""
    if not _is_enabled():
        return

    global _SYNC_PENDING, _SYNC_TIMER
    with _SYNC_LOCK:
        _SYNC_PENDING = True
        if _SYNC_TIMER is not None:
            _SYNC_TIMER.cancel()
        _SYNC_TIMER = threading.Timer(_DEBOUNCE_SECONDS, _run_debounced_sync)
        _SYNC_TIMER.daemon = True
        _SYNC_TIMER.start()
