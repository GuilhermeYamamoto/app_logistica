import xmlrpc.client
from typing import Any, Optional

from app.core.exceptions import AuthenticationError


class OdooRPC:
    def __init__(self, url: str):
        """
        Inicializa a conexão com o servidor Odoo usando a URL fornecida.
        """
        self.url = url.rstrip('/')

        self.common = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/common')

        self.models = xmlrpc.client.ServerProxy(f'{self.url}/xmlrpc/2/object')

        self.uid = None
        self.password = None
        self.db = None

    def authenticate(self, db: str, username: str, password: str) -> Optional[int]:
        """
        Autentica o usuário no servidor Odoo e armazena o ID do usuário (uid).
        """
        uid = self.common.authenticate(db, username, password, {})
        if not uid:
            raise AuthenticationError("Falha na autenticação. Verifique suas credenciais.")

        self.uid = uid
        self.db = db
        self.password = password

        return uid

    def set_authenticated_session(self, db: str, uid: int, password: str) -> None:
        self.db = db
        self.uid = uid
        self.password = password

    def execute(self, model: str, method: str, *args, **kwargs) -> Any:
        """
        Executa um método no modelo Odoo especificado.
        """
        if self.uid is None or self.password is None or self.db is None:
            raise Exception("Usuário não autenticado. Chame o método 'authenticate' primeiro.")

        return self.models.execute_kw(self.db, self.uid, self.password, model, method, args, kwargs)
