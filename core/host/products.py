"""Installed product services. The platform owns authentication and storage.

Only operator-installed Python distributions can register services. HTTP input
never chooses a module, filesystem location, or entry point to import.
"""
from importlib.metadata import entry_points
from .state import Problem
from .compatibility import validate_contract

class Products:
    def __init__(self, factories=None):
        self.services = {}
        entries = factories.items() if factories is not None else ((entry.name, entry.load()) for entry in entry_points(group="aether.products"))
        for name, factory in entries:
            if name in self.services:
                raise ValueError(f"Duplicate product service: {name}")
            contract = getattr(factory, "compatibility", None)
            if contract is not None:
                validate_contract(contract, name)
            service = factory()
            if service.app != name:
                raise ValueError(f"Product service identity mismatch: {name}")
            self.services[name] = service

    def initialize(self, host):
        for service in self.services.values():
            if hasattr(service, "initialize"):
                service.initialize(host)

    def get(self, app):
        if app not in self.services:
            raise Problem(503, f"The {app} service is not installed.")
        return self.services[app]

    def api(self, host, user, app, path, data):
        host.require_app(app, user)
        return self.get(app).api(host, user, path, data)

    def http(self, handler, host, method, path):
        if not path.startswith("/api/"):
            return False
        app = path.split("/", 3)[2]
        service = self.services.get(app)
        if service is None or not hasattr(service, "http"):
            return False
        return service.http(handler, host, method, path)

    def rpc(self, host, user, app, token, data):
        host.require_app(app, user)
        service = self.get(app)
        if not hasattr(service, "rpc"):
            raise Problem(404, "This application has no runtime RPC endpoint.")
        return service.rpc(host, user, app, token, data)

    def seed_workspace(self, root):
        for service in self.services.values():
            if hasattr(service, "seed_workspace"):
                service.seed_workspace(root)

    def supports_document(self, app, action, *, create=False):
        service = self.services.get(app)
        capabilities = "document_create_actions" if create else "document_actions"
        return action in getattr(service, capabilities, ())

    def document(self, library, action, user, data, row=None):
        service = self.get(data.get("app"))
        if not hasattr(service, "document"):
            raise Problem(400, "This application does not support that document operation.")
        return service.document(library, action, user, data, row)
