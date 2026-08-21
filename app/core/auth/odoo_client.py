"""Classe para conexão e comunicação com Odoo via XML-RPC."""

import logging
import xmlrpc.client
from typing import Any, Optional

from app.core.exceptions import AuthenticationError

logger = logging.getLogger(__name__)


class OdooClient:
    """
    Cliente para comunicação com servidor Odoo usando XML-RPC.
    
    Responsável por:
    - Autenticação e geração de UID
    - Execução de métodos remotos
    - Gerenciamento de credenciais
    """

    def __init__(self, url: str):
        """
        Inicializa conexão com servidor Odoo.
        
        Args:
            url: URL base do servidor Odoo (ex: https://seu-odoo.com)
        """
        self.url = url.rstrip('/')
        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')
        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')
        
        self.uid = None
        self.password = None
        self.db = None
        
        logger.info(f"OdooClient inicializado: {self.url}")

    def authenticate(self, db: str, username: str, password: str) -> int:
        """
        Autentica usuário no Odoo.
        
        Args:
            db: Nome do banco de dados Odoo
            username: Usuário Odoo
            password: Senha Odoo
            
        Returns:
            UID do usuário autenticado
            
        Raises:
            AuthenticationError: Se falhar na autenticação
        """
        try:
            uid = self.common.authenticate(db, username, password, {})
            if not uid:
                raise AuthenticationError(
                    "Falha na autenticação. Verifique usuário/senha."
                )
            
            self.uid = uid
            self.db = db
            self.password = password
            
            logger.info(f"Usuário autenticado: {username} (UID: {uid})")
            return uid
            
        except xmlrpc.client.Error as e:
            logger.error(f"Erro na autenticação XML-RPC: {e}")
            raise AuthenticationError(str(e)) from e

    def set_authenticated_session(self, db: str, uid: int, password: str) -> None:
        """
        Define uma sessão já autenticada.
        
        Útil para recuperar sessão do Redis sem fazer login novamente.
        
        Args:
            db: Nome do banco de dados
            uid: ID do usuário
            password: Senha do usuário
        """
        self.db = db
        self.uid = uid
        self.password = password
        logger.debug(f"Sessão restaurada para UID: {uid}")

    def execute(self, model: str, method: str, *args, **kwargs) -> Any:
        """
        Executa método em modelo Odoo.
        
        Args:
            model: Nome do modelo (ex: 'sale.order')
            method: Nome do método (ex: 'search', 'read', 'create')
            *args: Argumentos posicionais
            **kwargs: Argumentos nomeados
            
        Returns:
            Resultado da execução
            
        Raises:
            Exception: Se usuário não autenticado
        """
        if self.uid is None or self.password is None or self.db is None:
            raise Exception("Usuário não autenticado. Chame 'authenticate' primeiro.")
        
        try:
            result = self.models.execute_kw(
                self.db, self.uid, self.password, 
                model, method, args, kwargs
            )
            logger.debug(f"Execução bem-sucedida: {model}.{method}")
            return result
            
        except xmlrpc.client.Error as e:
            logger.error(f"Erro ao executar {model}.{method}: {e}")
            raise

    def search(self, model: str, domain: list = None, limit: int = None) -> list:
        """
        Busca registros no modelo.
        
        Args:
            model: Nome do modelo
            domain: Domínio de busca (ex: [('name', 'like', 'test')])
            limit: Limite de resultados
            
        Returns:
            Lista de IDs encontrados
        """
        domain = domain or []
        kwargs = {'limit': limit} if limit else {}
        return self.execute(model, 'search', domain, **kwargs)

    def read(self, model: str, ids: list, fields: list = None) -> list:
        """
        Lê dados de registros.
        
        Args:
            model: Nome do modelo
            ids: IDs dos registros
            fields: Campos a retornar
            
        Returns:
            Lista de dicionários com dados dos registros
        """
        fields = fields or []
        return self.execute(model, 'read', ids, fields)

    def create(self, model: str, values: dict) -> int:
        """
        Cria novo registro.
        
        Args:
            model: Nome do modelo
            values: Dicionário com valores
            
        Returns:
            ID do registro criado
        """
        return self.execute(model, 'create', values)

    def write(self, model: str, ids: list, values: dict) -> bool:
        """
        Atualiza registros.
        
        Args:
            model: Nome do modelo
            ids: IDs dos registros
            values: Dicionário com novos valores
            
        Returns:
            True se sucesso
        """
        return self.execute(model, 'write', ids, values)

    def delete(self, model: str, ids: list) -> bool:
        """
        Deleta registros.
        
        Args:
            model: Nome do modelo
            ids: IDs dos registros
            
        Returns:
            True se sucesso
        """
        return self.execute(model, 'unlink', ids)
