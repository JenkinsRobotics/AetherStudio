import pytest
from core.host.state import Problem
from core.host.tests.test_drive import drive


def test_workspace_icons_persist_and_require_admin(drive):
    host, users, call = drive
    workspace = call('workspace_create', {'name': 'Engineering', 'icon': 'settings'})['id']
    def icon():
        return next(w for w in call('administration')['workspaces'] if w['id'] == workspace)['icon']
    assert icon() == 'settings'
    assert next(w for w in call('context')['workspaces'] if w['id'] == workspace)['icon'] == 'settings'
    with pytest.raises(Problem):
        call('workspace_icon', {'workspace': workspace, 'icon': 'star'}, who=1)
    assert icon() == 'settings'
    call('workspace_icon', {'workspace': workspace, 'icon': 'camera'})
    assert icon() == 'camera'
    with pytest.raises(Problem):
        call('workspace_icon', {'workspace': workspace, 'icon': 'invalid'})
    assert icon() == 'camera'
    with pytest.raises(Problem):
        call('workspace_icon', {'workspace': workspace, 'icon': []})
    assert icon() == 'camera'
    call('workspace_icon', {'workspace': workspace, 'icon': None})
    assert icon() is None
