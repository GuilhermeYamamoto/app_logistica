"""Gerenciamento de sessões autenticadas com Redis e fallback para memória."""

import json
import logging
from dataclasses import asdict, dataclass
from secrets import token_urlsafe
from threading import Lock
from typing import Dict, Optional
from fastapi.responses import RedirectResponse

import redis

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OdooCredentials:
    """Credenciais armazenadas em sessão."""
    
    db: str
    username: str
    password: str
    uid: int


class BaseSessionStore:
    """Interface base para armazenamento de sessões."""

    def create(self, credentials: OdooCredentials) -> str:
        """Criar nova sessão."""
        raise NotImplementedError

    def get(self, token: Optional[str]) -> Optional[OdooCredentials]:
        """Recuperar credenciais da sessão."""
        raise NotImplementedError

    def delete(self, token: Optional[str]) -> None:
        """Deletar sessão."""
        raise NotImplementedError


class MemorySessionStore(BaseSessionStore):
    """Armazenamento em memória (para desenvolvimento/testes)."""

    def __init__(self) -> None:
        self._sessions: Dict[str, OdooCredentials] = {}
        self._lock = Lock()
        logger.info("MemorySessionStore inicializado (memória local)")

    def create(self, credentials: OdooCredentials) -> str:
        """Criar nova sessão em memória."""
        token = token_urlsafe(32)
        with self._lock:
            self._sessions[token] = credentials
        logger.debug(f"Sessão criada: {token[:8]}...")
        return token

    def get(self, token: Optional[str]) -> Optional[OdooCredentials]:
        """Recuperar credenciais da memória."""
        if token is None:
            return None

        with self._lock:
            return self._sessions.get(token)

    def delete(self, token: Optional[str]) -> None:
        """Deletar sessão da memória."""
        if token is None:
            return

        with self._lock:
            self._sessions.pop(token, None)
        logger.debug(f"Sessão deletada: {token[:8]}...")


class RedisSessionStore(BaseSessionStore):
    """Armazenamento de sessões em Redis com persistência."""

    def __init__(self, redis_url: str = None) -> None:
        """
        Inicializar store Redis.

        Args:
            redis_url: URL de conexão do Redis (ex: redis://localhost:6379/0)
        """
        redis_url = redis_url or settings.REDIS_URL
        self._fallback = None
        
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Testar conexão
            self.redis_client.ping()
            self.session_ttl = settings.SESSION_MAX_AGE  # TTL em segundos
            logger.info(f"RedisSessionStore inicializado: {redis_url}")
        except redis.ConnectionError as e:
            logger.error(f"Erro ao conectar no Redis: {e}")
            logger.warning("Caindo para sessões em memória")
            # Fallback para memória
            self._fallback = MemorySessionStore()
            self.redis_client = None

    def create(self, credentials: OdooCredentials) -> str:
        """Criar nova sessão."""
        token = token_urlsafe(32)

        if self.redis_client is None:
            return self._fallback.create(credentials)

        try:
            # Serializar credenciais
            data = json.dumps(asdict(credentials))
            # Armazenar no Redis com TTL
            self.redis_client.setex(
                f"session:{token}",
                self.session_ttl,
                data,
            )
            logger.debug(f"Sessão Redis criada: {token[:8]}...")
            return token
        except Exception as e:
            logger.error(f"Erro ao criar sessão no Redis: {e}")
            if self._fallback:
                return self._fallback.create(credentials)
            return token

    def get(self, token: Optional[str]) -> Optional[OdooCredentials]:
        """Recuperar credenciais da sessão."""
        if token is None:
            return None

        if self.redis_client is None:
            return self._fallback.get(token)

        try:
            data = self.redis_client.get(f"session:{token}")
            if data is None:
                return None

            credentials_dict = json.loads(data)
            return OdooCredentials(**credentials_dict)
        except Exception as e:
            logger.error(f"Erro ao recuperar sessão do Redis: {e}")
            return None

    def delete(self, token: Optional[str]) -> None:
        """Deletar sessão."""
        if token is None:
            return

        if self.redis_client is None:
            self._fallback.delete(token)
            return

        try:
            self.redis_client.delete(f"session:{token}")
            logger.debug(f"Sessão Redis deletada: {token[:8]}...")
        except Exception as e:
            logger.error(f"Erro ao deletar sessão do Redis: {e}")

    def cleanup_expired(self) -> int:
        """Limpar sessões expiradas (Redis faz isso automaticamente)."""
        if self.redis_client is None:
            return 0

        try:
            keys = self.redis_client.keys("session:*")
            logger.info(f"Sessões ativas: {len(keys)}")
            return len(keys)
        except Exception as e:
            logger.error(f"Erro ao limpar sessões: {e}")
            return 0


# Instância global de sessões
# Usa Redis se disponível, caso contrário, fallback para memória
try:
    session_store = RedisSessionStore()
except Exception:
    logger.warning("Redis indisponível, usando sessões em memória")
    session_store = MemorySessionStore()

