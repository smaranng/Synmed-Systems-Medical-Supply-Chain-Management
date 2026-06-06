from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional in minimal runtime setups
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENGINE_DIR = BACKEND_DIR / "src"
DATA_DIR = BACKEND_DIR / "data"
ENV_FILE = BACKEND_DIR / ".env"


def load_app_environment() -> None:
    """Load backend environment variables from backend/.env."""
    load_dotenv(ENV_FILE)


load_app_environment()
