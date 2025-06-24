import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from embeddings import embed_and_store, load_or_create_index

# Folders to ignore
IGNORE_DIRS = {
    ".venv", "venv", "__pycache__", ".git",
    "node_modules", ".idea", ".vscode", "vectorstore"
}

# File extensions we actually process
VALID_EXTENSIONS = (".py", ".js", ".ts", ".md")

class CodeChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.is_directory:
            return

        file_path = os.path.abspath(event.src_path)
        print(f"Detected change: {file_path}")

        # skip ignored dirs
        parts = os.path.normpath(file_path).split(os.sep)
        if any(p in IGNORE_DIRS for p in parts):
            print(f"Ignored (dir): {file_path}")
            return

        # skip uninteresting extensions
        if not file_path.endswith(VALID_EXTENSIONS):
            print(f"Ignored (ext): {file_path}")
            return

        try:
            print(f"Processing: {file_path}")
            embed_and_store(file_path)
            print(f"Success:    {file_path}")
        except Exception as e:
            print(f"Failed:     {file_path}")
            print(f"Error:      {e}", flush=True)
            import traceback; traceback.print_exc()

def start_watching(watch_path):
    WATCH_PATH = os.path.abspath(watch_path)
    if not os.path.exists(WATCH_PATH):
        print(f"Error: watch path not found: {WATCH_PATH}")
        return

    # build or load the FAISS index
    load_or_create_index()
    print("Vector index ready")
    print(f"Watching: {WATCH_PATH}")
    print(f"Ignoring dirs:    {IGNORE_DIRS}")
    print(f"Tracking exts:    {VALID_EXTENSIONS}")

    observer = Observer()
    observer.schedule(CodeChangeHandler(), path=WATCH_PATH, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


# import os
# import time
# from watchdog.observers import Observer
# from watchdog.events import FileSystemEventHandler
# from embeddings import embed_and_store, load_or_create_index

# # Folders to ignore
# IGNORE_DIRS = {".venv", "venv", "__pycache__", ".git", "node_modules", ".idea", ".vscode", "vectorstore"}

# # Extensions to track
# VALID_EXTENSIONS = (".py", ".js", ".ts", ".md")

# class CodeChangeHandler(FileSystemEventHandler):
#     def on_modified(self, event):
#         if event.is_directory:
#             return

#         file_path = os.path.abspath(event.src_path)
#         print(f"Detected change in: {file_path}")

#         # Normalize and split the path
#         normalized = os.path.normpath(file_path)
#         parts = normalized.split(os.sep)

#         # Check if any part of the path is in the ignore list
#         if any(part in IGNORE_DIRS for part in parts):
#             print(f"Ignored (directory filter): {file_path}")
#             return

#         # Only process allowed file types
#         if not file_path.endswith(VALID_EXTENSIONS):
#             print(f"Ignored (extension filter): {file_path}")
#             return

#         try:
#             print(f"Processing: {file_path}")
#             embed_and_store(file_path)
#             print(f"Success: {file_path}")
#         except Exception as e:
#             print(f"Processing failed: {file_path}")
#             print(f"Error: {str(e)}")
#             import traceback
#             traceback.print_exc()

# def start_watching(watch_path):
#     # Convert to absolute path and validate
#     WATCH_PATH = os.path.abspath(watch_path)
#     if not os.path.exists(WATCH_PATH):
#         print(f"Error: Path does not exist: {WATCH_PATH}")
#         return

#     print(f"Started watching at: {WATCH_PATH} for changes")

#     load_or_create_index()
#     print("Vector index ready")
    
#     event_handler = CodeChangeHandler()
#     observer = Observer()
#     observer.schedule(event_handler, path=WATCH_PATH, recursive=True)
#     observer.start()
#     print(f"Watching {WATCH_PATH} for changes")
#     print(f"Ignoring directories: {IGNORE_DIRS}")
#     print(f"Tracking extensions: {VALID_EXTENSIONS}")

#     try:
#         while True:
#             time.sleep(1)
#     except KeyboardInterrupt:
#         observer.stop()
#     observer.join()
