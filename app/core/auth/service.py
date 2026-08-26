"""Serviço de autenticação e CRUD com Odoo."""

import logging
import xmlrpc.client
from typing import Dict, List, Optional

from app.config import settings
from app.core.auth.odoo_client import OdooClient
from app.core.auth.session import OdooCredentials, session_store
from app.core.exceptions import AuthenticationError, OdooConnectionError

logger = logging.getLogger(__name__)


class OdooAuthService:
    """
    Serviço centralizado para operações de autenticação com Odoo.
    
    Responsável por:
    - Autenticação de usuários
    - Gerenciamento de sessões
    - Operações CRUD
    - Recuperação de dados de inventário
    """

    @staticmethod
    def authenticate(username: str, password: str) -> str:
        """
        Autentica usuário no Odoo e retorna token de sessão.

        Args:
            username: Nome de usuário
            password: Senha

        Returns:
            Token de sessão

        Raises:
            AuthenticationError: Se falhar na autenticação
            OdooConnectionError: Se não conseguir conectar ao Odoo
        """
        try:
            client = OdooClient(settings.ODOO_URL)
            uid = client.authenticate(
                db=settings.ODOO_DB,
                username=username,
                password=password,
            )
        except AuthenticationError:
            raise
        except (OSError, xmlrpc.client.Error) as e:
            raise OdooConnectionError(
                "Não foi possível conectar ao Odoo. Tente novamente."
            ) from e

        # Criar sessão
        session_token = session_store.create(
            OdooCredentials(
                db=settings.ODOO_DB,
                username=username,
                password=password,
                uid=uid,
            )
        )
        logger.info(f"Usuário autenticado e sessão criada: {username}")
        return session_token

    @staticmethod
    def logout(token: Optional[str]) -> None:
        """
        Remove a sessão do usuário.
        
        Args:
            token: Token de sessão
        """
        if token:
            session_store.delete(token)
            logger.info(f"Sessão finalizada: {token[:8]}...")

    @staticmethod
    def get_credentials(token: Optional[str]) -> Optional[OdooCredentials]:
        """
        Recupera credenciais da sessão.
        
        Args:
            token: Token de sessão
            
        Returns:
            Credenciais ou None se token inválido
        """
        return session_store.get(token)

    @staticmethod
    def create_client_from_session(credentials: OdooCredentials) -> OdooClient:
        """
        Cria cliente Odoo usando credenciais de sessão.
        
        Args:
            credentials: Credenciais armazenadas em sessão
            
        Returns:
            Cliente Odoo configurado
        """
        client = OdooClient(settings.ODOO_URL)
        client.set_authenticated_session(
            db=credentials.db,
            uid=credentials.uid,
            password=credentials.password,
        )
        return client

    # ========== OPERAÇÕES CRUD ==========

    @staticmethod
    def search(
        credentials: OdooCredentials,
        model: str,
        domain: List = None,
        limit: int = None,
    ) -> List[int]:
        """
        Busca registros em modelo.
        
        Args:
            credentials: Credenciais da sessão
            model: Nome do modelo
            domain: Critério de busca
            limit: Limite de resultados
            
        Returns:
            Lista de IDs encontrados
        """
        client = OdooAuthService.create_client_from_session(credentials)
        return client.search(model, domain or [], limit)

    @staticmethod
    def read(
        credentials: OdooCredentials,
        model: str,
        ids: List[int],
        fields: List[str] = None,
    ) -> List[Dict]:
        """
        Lê dados de registros.
        
        Args:
            credentials: Credenciais da sessão
            model: Nome do modelo
            ids: IDs dos registros
            fields: Campos a retornar
            
        Returns:
            Lista de dicionários com dados
        """
        client = OdooAuthService.create_client_from_session(credentials)
        return client.read(model, ids, fields or [])

    @staticmethod
    def create(
        credentials: OdooCredentials,
        model: str,
        values: Dict,
    ) -> int:
        """
        Cria novo registro.
        
        Args:
            credentials: Credenciais da sessão
            model: Nome do modelo
            values: Valores do registro
            
        Returns:
            ID do registro criado
        """
        client = OdooAuthService.create_client_from_session(credentials)
        return client.create(model, values)

    @staticmethod
    def write(
        credentials: OdooCredentials,
        model: str,
        ids: List[int],
        values: Dict,
    ) -> bool:
        """
        Atualiza registros.
        
        Args:
            credentials: Credenciais da sessão
            model: Nome do modelo
            ids: IDs dos registros
            values: Novos valores
            
        Returns:
            True se sucesso
        """
        client = OdooAuthService.create_client_from_session(credentials)
        return client.write(model, ids, values)

    @staticmethod
    def delete(
        credentials: OdooCredentials,
        model: str,
        ids: List[int],
    ) -> bool:
        """
        Deleta registros.
        
        Args:
            credentials: Credenciais da sessão
            model: Nome do modelo
            ids: IDs dos registros
            
        Returns:
            True se sucesso
        """
        client = OdooAuthService.create_client_from_session(credentials)
        return client.delete(model, ids)
