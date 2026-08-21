"""Configurações centralizadas da aplicação."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações da aplicação."""

    # Odoo
    ODOO_URL: str = "https://trn-serp.indufix.com.br"
    ODOO_DB: str = "odoo-trn"

    # Segurança
    SESSION_COOKIE_NAME: str = "odoo_session"
    SESSION_MAX_AGE: int = 60 * 60 * 8  # 8 horas

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # FastAPI
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    TEMPLATES_DIR: Path = BASE_DIR / "templates"
    STATIC_DIR: Path = BASE_DIR / "static"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
