import os
import shutil
import time
import hashlib
import socket
import requests
import threading
from flask import Flask, request, jsonify
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# config
WATCH_DIR = "../data/monitored"
BACKUP_DIR = "../data/backup"
QUARANTINE_DIR = "../data/quarantine"
API_URL = "http://localhost:3000/alerts"

app = Flask(__name__)

@app.route('/update_baseline', methods=['POST'])
def update_baseline():
    data = request.json
    raw_filename = data.get("filename", "")
    
    filename = os.path.basename(raw_filename.replace('\\', '/'))
    
    q_files = [f for f in os.listdir(QUARANTINE_DIR) if f.endswith(f"_{filename}")]
    
    if not q_files:
        return jsonify({"error": "Arquivo não encontrado na quarentena"}), 404
        
    q_files.sort(reverse=True)
    latest_quarantine = os.path.join(QUARANTINE_DIR, q_files[0])
    
    dst_watch = os.path.join(WATCH_DIR, filename)
    dst_backup = os.path.join(BACKUP_DIR, filename)
    
    shutil.copy2(latest_quarantine, dst_backup)
    shutil.copy2(latest_quarantine, dst_watch)
    
    return jsonify({"msg": f"Baseline de '{filename}' atualizada com sucesso!"}), 200

def run_api():
    app.run(port=5005, host='127.0.0.1', use_reloader=False)

# diretorios
for directory in [WATCH_DIR, BACKUP_DIR, QUARANTINE_DIR]:
    os.makedirs(directory, exist_ok=True)

def generate_hash(file_path):
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except FileNotFoundError:
        return None

def sync_baseline():
    #cópia de segurança inicial dos arquivos
    for filename in os.listdir(WATCH_DIR):
        src = os.path.join(WATCH_DIR, filename)
        dst = os.path.join(BACKUP_DIR, filename)
        if os.path.isfile(src) and not os.path.exists(dst):
            shutil.copy2(src, dst)
    print(f"[SISTEMA] Baseline de segurança estabelecida em {BACKUP_DIR}")

class ActiveDefenseHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.is_directory: return

        filepath = event.src_path
        filename = os.path.basename(filepath)
        backup_path = os.path.join(BACKUP_DIR, filename)

        new_hash = generate_hash(filepath)
        backup_hash = generate_hash(backup_path) if os.path.exists(backup_path) else None

        if new_hash == backup_hash:
            return

        quarantine_path = os.path.join(QUARANTINE_DIR, f"{int(time.time())}_{filename}")
        # quarentena
        try:
            shutil.move(filepath, quarantine_path)
        except Exception as e:
            print(f"[ERRO] Falha ao mover: {e}")
            return
        
        # rollback
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, filepath)
            print(f"[DEFESA ATIVA] Incidente contido. Arquivo '{filename}' restaurado e enviado para quarentena.")

        # notificacao
        payload = {
            "file_path": filepath,
            "new_hash": new_hash,
            "event_type": "MODIFIED_QUARANTINED",
            "modified_by_user": os.getlogin(),
            "machine_name": socket.gethostname()
        }
        
        try:
            requests.post(API_URL, json=payload)
        except Exception as e:
            pass

if __name__ == "__main__":
    sync_baseline()
    
    threading.Thread(target=run_api, daemon=True).start()
    
    event_handler = ActiveDefenseHandler()
    observer = Observer()
    observer.schedule(event_handler, WATCH_DIR, recursive=False)
    
    print(f"Monitoramento e Defesa Ativa iniciados em: {WATCH_DIR}")
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()