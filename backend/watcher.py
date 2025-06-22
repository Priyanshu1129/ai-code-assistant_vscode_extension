import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from embeddings import embed_and_store, load_or_create_index

WATCH_PATH = "./"  # Watches current project directory

# Folders to ignore
IGNORE_DIRS = {".venv", "venv", "__pycache__", ".git", "node_modules", ".idea", ".vscode", "vectorstore"}

# Extensions to track
VALID_EXTENSIONS = (".py", ".js", ".ts", ".md")

class CodeChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.is_directory:
            return

        file_path = event.src_path

        # Normalize and split the path
        normalized = os.path.normpath(file_path)
        parts = normalized.split(os.sep)

        # Check if any part of the path is in the ignore list
        if any(part in IGNORE_DIRS for part in parts):
            return

        # Only process allowed file types
        if not file_path.endswith(VALID_EXTENSIONS):
            return

        embed_and_store(file_path)

def start_watching():
    load_or_create_index()
    event_handler = CodeChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, path=WATCH_PATH, recursive=True)
    observer.start()
    print(f"[👁️] Watching {WATCH_PATH} for changes (excluding {IGNORE_DIRS})...")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    start_watching()
