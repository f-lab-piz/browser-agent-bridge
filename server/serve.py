"""SDK 디렉터리만 제공하는 로컬 정적 서버."""
import argparse, functools, http.server
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=29652);parser.add_argument('--bind',default='127.0.0.1');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'sdk'
class Handler(http.server.SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
server=http.server.ThreadingHTTPServer((args.bind,args.port),functools.partial(Handler,directory=str(root)))
print(f'SDK: http://{args.bind}:{server.server_address[1]}/manifest.json',flush=True)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
