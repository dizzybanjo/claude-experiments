#!/usr/bin/env python3
"""
serve.py — launch the EILIAD dashboard with the latest CSV auto-loaded.
Run from the same directory as eiliad-thetuning-analyticsdash.html, or from anywhere.
"""
import http.server
import os
import glob
import json
import webbrowser
import threading

PORT = 8847
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILE  = 'eiliad-thetuning-analyticsdash.html'


def find_latest_csv():
    csvs = glob.glob(os.path.join(SCRIPT_DIR, '*.csv'))
    if not csvs:
        return None
    return max(csvs, key=os.path.getmtime)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SCRIPT_DIR, **kwargs)

    def do_GET(self):
        if self.path == '/api/latest-csv':
            latest = find_latest_csv()
            name   = os.path.basename(latest) if latest else None
            body   = json.dumps({'file': name}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def log_message(self, format, *args):
        pass  # silence per-request logs


def open_browser():
    import time
    time.sleep(0.4)
    webbrowser.open(f'http://localhost:{PORT}/{HTML_FILE}')


threading.Thread(target=open_browser, daemon=True).start()

latest = find_latest_csv()
print(f'EILIAD dashboard → http://localhost:{PORT}/{HTML_FILE}')
print(f'Auto-loading:      {os.path.basename(latest) if latest else "no CSV found — upload manually"}')
print('Press Ctrl+C to stop.\n')

with http.server.HTTPServer(('', PORT), Handler) as httpd:
    httpd.serve_forever()
