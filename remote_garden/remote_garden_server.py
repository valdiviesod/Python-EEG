#!/usr/bin/env python3
"""
Mirror server for campo resonante (GalaxyGarden only).

Deploy with pulse/ + remote_garden/ from repo root, then:
  python remote_garden/remote_garden_server.py

Configure via .env (not committed):
  GARDEN_HOST=0.0.0.0
  GARDEN_PORT=9040
  GARDEN_SYNC_KEY=optional-shared-secret
  GARDEN_DATA_DIR=remote_garden/data
"""

from __future__ import annotations

import argparse
import json
import os
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
WEB_DIR = ROOT / 'web'
PULSE_DIR = WORKSPACE / 'pulse'
APP_DIR = WORKSPACE / 'app'
DEFAULT_DATA_DIR = ROOT / 'data'

_STORE_LOCK = Lock()
_STORE = {
    'profiles': [],
    'captures': {},
    'sync_token': '',
    'synced_at': '',
    'updated_at': 0.0,
}


def _load_env() -> dict[str, str]:
    merged = dict(os.environ)
    for env_path in (WORKSPACE / '.env', ROOT / '.env'):
        if not env_path.is_file():
            continue
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            merged[key.strip()] = value.strip().strip('"').strip("'")
    return merged


def _data_file() -> Path:
    env = _load_env()
    custom = str(env.get('GARDEN_DATA_DIR', '')).strip()
    if custom:
        path = Path(custom)
        if not path.is_absolute():
            path = WORKSPACE / path
        return path / 'garden_state.json'
    return DEFAULT_DATA_DIR / 'garden_state.json'


def _sync_key_expected() -> str:
    env = _load_env()
    return str(env.get('GARDEN_SYNC_KEY', env.get('REMOTE_GARDEN_SYNC_KEY', ''))).strip()


def _persist_state():
    data_file = _data_file()
    data_file.parent.mkdir(parents=True, exist_ok=True)
    with _STORE_LOCK:
        snapshot = {
            'profiles': _STORE['profiles'],
            'captures': _STORE['captures'],
            'sync_token': _STORE['sync_token'],
            'synced_at': _STORE['synced_at'],
            'updated_at': _STORE['updated_at'],
        }
    data_file.write_text(json.dumps(snapshot, ensure_ascii=False), encoding='utf-8')


def _load_persisted_state():
    data_file = _data_file()
    if not data_file.is_file():
        return
    try:
        snapshot = json.loads(data_file.read_text(encoding='utf-8'))
        with _STORE_LOCK:
            _STORE['profiles'] = snapshot.get('profiles', [])
            _STORE['captures'] = snapshot.get('captures', {})
            _STORE['sync_token'] = snapshot.get('sync_token', '')
            _STORE['synced_at'] = snapshot.get('synced_at', '')
            _STORE['updated_at'] = float(snapshot.get('updated_at') or 0)
        print(f'📂 Estado remoto cargado: {len(_STORE["profiles"])} perfiles')
    except Exception as exc:
        print(f'⚠️ No se pudo cargar estado remoto: {exc}')


class RemoteGardenHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def _send_json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except BrokenPipeError:
            return

    def _read_json_body(self) -> dict:
        content_length = int(self.headers.get('Content-Length', '0'))
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length)
        return json.loads(raw.decode('utf-8'))

    def _check_sync_key(self) -> bool:
        expected = _sync_key_expected()
        if not expected:
            return True
        provided = self.headers.get('X-Garden-Sync-Key', '').strip()
        if not provided:
            body = getattr(self, '_last_body', {})
            provided = str(body.get('sync_key', '')).strip()
        return provided == expected

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Garden-Sync-Key')
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/sync':
            try:
                body = self._read_json_body()
                self._last_body = body
                if not self._check_sync_key():
                    self._send_json(403, {'ok': False, 'error': 'Sync key inválida'})
                    return

                profiles = body.get('profiles')
                captures = body.get('captures')
                if not isinstance(profiles, list) or not isinstance(captures, dict):
                    self._send_json(400, {'ok': False, 'error': 'Payload inválido'})
                    return

                with _STORE_LOCK:
                    _STORE['profiles'] = profiles
                    _STORE['captures'] = captures
                    _STORE['sync_token'] = str(body.get('sync_token') or f'{len(profiles)}:{len(captures)}')
                    _STORE['synced_at'] = str(body.get('synced_at') or time.strftime('%Y-%m-%d %H:%M:%S'))
                    _STORE['updated_at'] = time.time()

                _persist_state()
                print(
                    f'☁️ Sync recibido: {len(profiles)} perfiles, {len(captures)} capturas '
                    f'({_STORE["synced_at"]})'
                )
                self._send_json(200, {
                    'ok': True,
                    'profiles': len(profiles),
                    'captures': len(captures),
                    'sync_token': _STORE['sync_token'],
                })
            except Exception as exc:
                traceback.print_exc()
                self._send_json(500, {'ok': False, 'error': str(exc)})
            return

        self._send_json(404, {'ok': False, 'error': 'Endpoint no encontrado'})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in {'/', '/index.html'}:
            return self._serve_file(WEB_DIR / 'index.html', 'text/html; charset=utf-8')

        if path == '/app.js':
            return self._serve_file(WEB_DIR / 'app.js', 'application/javascript; charset=utf-8')

        if path == '/style.css':
            return self._serve_file(WEB_DIR / 'style.css', 'text/css; charset=utf-8')

        if path == '/nad_intro_galaxy.js':
            return self._serve_file(APP_DIR / 'nad_intro_galaxy.js', 'application/javascript; charset=utf-8')

        if path.startswith('/pulse/'):
            rel = path[len('/pulse/'):]
            if '..' in rel or rel.startswith('/'):
                self._send_json(400, {'ok': False, 'error': 'Ruta inválida'})
                return
            target = PULSE_DIR / rel
            if target.is_file():
                ctype = 'application/javascript; charset=utf-8' if rel.endswith('.js') else 'application/octet-stream'
                return self._serve_file(target, ctype)

        if path == '/api/profiles/list':
            with _STORE_LOCK:
                payload = {
                    'ok': True,
                    'profiles': list(_STORE['profiles']),
                    'sync_token': _STORE['sync_token'],
                    'synced_at': _STORE['synced_at'],
                    'updated_at': _STORE['updated_at'],
                }
            self._send_json(200, payload)
            return

        if path == '/api/sync/meta':
            with _STORE_LOCK:
                payload = {
                    'ok': True,
                    'sync_token': _STORE['sync_token'],
                    'synced_at': _STORE['synced_at'],
                    'updated_at': _STORE['updated_at'],
                    'profile_count': len(_STORE['profiles']),
                    'capture_count': len(_STORE['captures']),
                }
            self._send_json(200, payload)
            return

        if path == '/api/garden/file':
            query = parse_qs(parsed.query)
            filename = query.get('name', [''])[0]
            if not filename or '..' in filename or '/' in filename or '\\' in filename:
                self._send_json(400, {'ok': False, 'error': 'Nombre de archivo inválido'})
                return
            with _STORE_LOCK:
                data = _STORE['captures'].get(filename)
            if not data:
                self._send_json(404, {'ok': False, 'error': 'Archivo no encontrado'})
                return
            body = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except BrokenPipeError:
                return
            return

        self._send_json(404, {'ok': False, 'error': 'No encontrado'})

    def _serve_file(self, filepath: Path, content_type: str):
        if not filepath.is_file():
            self._send_json(404, {'ok': False, 'error': 'Archivo no encontrado'})
            return
        body = filepath.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            return

    def log_message(self, format, *args):
        if args and isinstance(args[0], str) and '/api/sync/meta' in args[0]:
            return
        super().log_message(format, *args)


def main():
    env = _load_env()
    parser = argparse.ArgumentParser(description='Campo resonante remoto (mirror)')
    parser.add_argument('--host', default=env.get('GARDEN_HOST', '0.0.0.0'))
    parser.add_argument('--port', type=int, default=int(env.get('GARDEN_PORT', '9040')))
    args = parser.parse_args()

    _load_persisted_state()

    server = ThreadingHTTPServer((args.host, args.port), RemoteGardenHandler)
    url = f'http://{args.host}:{args.port}'
    print('═' * 72)
    print('🌌 Campo resonante remoto — mirror GalaxyGarden')
    print('═' * 72)
    print(f'  UI:   {url}/')
    print(f'  Sync: POST {url}/api/sync')
    print(f'  Pulse assets: {PULSE_DIR}')
    print('═' * 72)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n⏹️ Servidor remoto detenido.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
