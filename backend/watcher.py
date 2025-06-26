import os
import time
import traceback
import logging
from watchdog.events import FileSystemEventHandler
try:
    # use native observer if available
    from watchdog.observers import Observer
except ImportError:
    # fallback to polling observer
    from watchdog.observers.polling import PollingObserver as Observer

from embeddings import embed_and_store, load_or_create_index

# Folders to ignore
IGNORE_DIRS = {".venv", "venv", "__pycache__", ".git",
               "node_modules", ".idea", ".vscode", "vectorstore"}
# File extensions we actually process
VALID_EXTENSIONS = (".py", ".js", ".ts", ".md")

# Configure module-level logger
def _setup_logger():
    logger = logging.getLogger("watcher")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("[watcher] %(asctime)s %(levelname)s: %(message)s")
        )
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger

logger = _setup_logger()

class CodeChangeHandler(FileSystemEventHandler):
    def on_any_event(self, event):
        logger.info(f"any_event: {event.event_type} → {event.src_path}")

    def on_modified(self, event):
        self._handle(event)

    def on_created(self, event):
        self._handle(event)

    def on_moved(self, event):
        # treat destination path as the changed file
        event.src_path = event.dest_path
        self._handle(event)

    def _handle(self, event):
        # ignore directories
        if event.is_directory:
            return

        file_path = os.path.abspath(event.src_path)
        logger.info(f"Detected change: {file_path}")

        parts = os.path.normpath(file_path).split(os.sep)
        if any(p in IGNORE_DIRS for p in parts):
            logger.debug(f"Ignored (dir): {file_path}")
            return

        if not file_path.endswith(VALID_EXTENSIONS):
            logger.debug(f"Ignored (ext): {file_path}")
            return

        try:
            logger.info(f"Processing: {file_path}")
            embed_and_store(file_path)
            logger.info(f"Success:    {file_path}")
        except Exception:
            logger.error(f"Failed:     {file_path}", exc_info=True)


def start_watching(watch_path: str):
    logger.info("Starting watcher thread entry")
    try:
        WATCH_PATH = os.path.abspath(watch_path)
        logger.info(f"Resolved watch path: {watch_path} → {WATCH_PATH}")
        if not os.path.exists(WATCH_PATH):
            logger.error(f"Watch path not found: {WATCH_PATH}")
            return

        # load or create the vector index before monitoring
        load_or_create_index()
        logger.info("Vector index ready")

        handler = CodeChangeHandler()
        observer = Observer()
        observer.schedule(handler, path=WATCH_PATH, recursive=True)
        observer.start()

        logger.info(f"Observer started on: {WATCH_PATH}")
        logger.info(f"Ignoring dirs: {IGNORE_DIRS}")
        logger.info(f"Tracking exts: {VALID_EXTENSIONS}")

        # keep the thread alive
        while True:
            time.sleep(1)
    except Exception:
        logger.error("Watcher crashed", exc_info=True)
