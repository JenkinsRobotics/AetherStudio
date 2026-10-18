"""Registration, authorization and uninstalled-product behavior."""
from types import SimpleNamespace
import pytest
from core.host.products import Products
from core.host.server import StudioHost
from core.host.state import Problem

class Example:
    app = "example"
    document_create_actions = ("new_project",)
    document_actions = ("inspect",)
    calls = []
    def api(self, host, user, path, data):
        self.calls.append(path)
        return {"ok": True}

def test_platform_starts_without_any_product_runtime(tmp_path):
    host = StudioHost(tmp_path, products=Products({}))
    assert not host.products.services
    assert host.store.db.execute("SELECT name FROM sqlite_master WHERE name='map_devices'").fetchone() is None
    assert host.library.dispatch  # Generic account/file storage remains usable.
    with pytest.raises(Problem) as error:
        host.products.get("cad")
    assert error.value.status == 503

def test_entitlement_is_checked_before_product_code_runs():
    registry = Products({"example": Example})
    def denied(app, user):
        raise Problem(403, "Disabled")
    host = SimpleNamespace(require_app=denied)
    with pytest.raises(Problem) as error:
        registry.api(host, {}, "example", "/api/example/run", {})
    assert error.value.status == 403
    assert registry.get("example").calls == []

def test_registration_identity_and_document_capabilities():
    with pytest.raises(ValueError, match="identity mismatch"):
        Products({"wrong": Example})
    registry = Products({"example": Example})
    assert registry.supports_document("example", "new_project", create=True)
    assert not registry.supports_document("example", "inspect", create=True)
    assert registry.supports_document("example", "inspect")
    assert not registry.supports_document("uninstalled", "inspect")

def test_http_dispatch_cannot_import_a_requested_module():
    registry = Products({})
    assert registry.http(None, None, "GET", "/api/os/system") is False
    assert registry.http(None, None, "GET", "/assets/index.js") is False

def test_cad_api_respects_disabled_app_before_starting_engine(tmp_path):
    host = StudioHost(tmp_path)
    host.store.create_user("owner", "test-password-not-for-real-use", "admin", False)
    token = host.store.sign_in("owner", "test-password-not-for-real-use", "127.0.0.1")
    host.store.db.execute("UPDATE applications SET enabled=0 WHERE id='cad'")
    with pytest.raises(Problem) as error:
        host.dispatch("/api/cad/engine", {}, token, "127.0.0.1")
    assert error.value.status == 403
    assert host.products.get("cad").engines == {}
