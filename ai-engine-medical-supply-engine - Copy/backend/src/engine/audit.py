import sys


class AuditLogger:
    def __init__(self):
        self.logs = []
        self._stdout_prepared = False

    def _prepare_stdout(self):
        if self._stdout_prepared:
            return
        stdout = sys.stdout
        if hasattr(stdout, "reconfigure"):
            try:
                stdout.reconfigure(encoding="utf-8")
            except (AttributeError, ValueError):
                pass
        self._stdout_prepared = True

    def log(self, message):
        self._prepare_stdout()
        try:
            print(message)
        except UnicodeEncodeError:
            encoded = f"{message}\n".encode(
                sys.stdout.encoding or "utf-8",
                errors="replace",
            )
            sys.stdout.buffer.write(encoded)
            sys.stdout.buffer.flush()
        self.logs.append(message)

    def get_logs(self):
        return self.logs
