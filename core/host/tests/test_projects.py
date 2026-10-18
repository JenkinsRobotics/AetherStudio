import json
import pytest
from core.host.projects import project_path

def test_manifest_resolves_relative_to_its_own_location(tmp_path, monkeypatch):
    platform=tmp_path/'platform';platform.mkdir()
    manifest=platform/'projects.json'
    manifest.write_text(json.dumps({'schema':1,'projects':{'map':'../map'}}))
    monkeypatch.setenv('AETHER_PROJECTS_FILE',str(manifest))
    assert project_path('map')==tmp_path/'map'

def test_manifest_rejects_unknown_schema_and_unregistered_product(tmp_path, monkeypatch):
    manifest=tmp_path/'projects.json';monkeypatch.setenv('AETHER_PROJECTS_FILE',str(manifest))
    manifest.write_text(json.dumps({'schema':2,'projects':{}}))
    with pytest.raises(ValueError):project_path('map')
    manifest.write_text(json.dumps({'schema':1,'projects':{}}))
    with pytest.raises(KeyError):project_path('unregistered')
