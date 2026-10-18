"""Aether Map project bundles."""

import io
import json
import zipfile

import pytest

from aether_map_service.project import build_bundle, safe_folder, wireframe_svg
from core.host.state import Problem

SHOW = {
    "version": 2,
    "output": {"width": 1280, "height": 720},
    "media": [
        {"id": "m1", "file": "m1.png", "name": "ghost.png", "kind": "image"},
    ],
    "scenes": [
        {
            "id": "sc1",
            "name": "Idle",
            "durationS": 30,
            "surfaces": [
                {
                    "id": "s1",
                    "name": "Front door",
                    "corners": [[10, 20], [110, 20], [110, 120], [10, 120]],
                    "mask": [[20, 30], [100, 30], [100, 110]],
                }
            ],
        }
    ],
}


def bundle(tmp_path, show=SHOW, name="Halloween.aethermap", assets=("m1.png",)):
    media = tmp_path / "map-media"
    media.mkdir(exist_ok=True)
    for asset in assets:
        (media / asset).write_bytes(b"\x89PNG\r\n\x1a\n")
    return zipfile.ZipFile(
        io.BytesIO(build_bundle(name, json.dumps(show).encode(), media))
    )


def test_the_bundle_is_one_named_folder_holding_everything(tmp_path):
    names = bundle(tmp_path).namelist()
    assert sorted(names) == sorted(
        [
            "Halloween/show.aethermap",
            "Halloween/layout.json",
            "Halloween/wireframe.svg",
            "Halloween/media/m1.png",
            "Halloween/README.txt",
        ]
    )


def test_the_document_survives_the_round_trip(tmp_path):
    archive = bundle(tmp_path)
    assert json.loads(archive.read("Halloween/show.aethermap")) == SHOW


def test_a_missing_asset_is_reported_rather_than_silently_dropped(tmp_path):
    # A bundle quietly lacking its media looks fine until show day.
    archive = bundle(tmp_path, assets=())
    assert "Halloween/MISSING-ASSETS.txt" in archive.namelist()
    assert "m1.png" in archive.read("Halloween/MISSING-ASSETS.txt").decode()


def test_a_traversing_asset_name_never_leaves_the_media_directory(tmp_path):
    show = json.loads(json.dumps(SHOW))
    show["media"][0]["file"] = "../../../etc/passwd"
    archive = bundle(tmp_path, show=show)
    assert not any("etc/passwd" in name for name in archive.namelist())
    assert "Halloween/MISSING-ASSETS.txt" in archive.namelist()


def test_an_unreadable_show_is_refused(tmp_path):
    media = tmp_path / "map-media"
    media.mkdir()
    with pytest.raises(Problem):
        build_bundle("x.aethermap", b"not json", media)
    with pytest.raises(Problem):
        build_bundle("x.aethermap", b"[1,2,3]", media)


class TestWireframe:
    def test_it_draws_a_polygon_per_surface_and_a_dashed_mask(self):
        svg = wireframe_svg(SHOW, "Halloween")
        assert svg.startswith("<svg")
        assert 'viewBox="0 0 1280 720"' in svg
        assert "10,20 110,20 110,120 10,120" in svg
        assert "stroke-dasharray" in svg
        assert svg.rstrip().endswith("</svg>")

    def test_it_names_surfaces_and_scenes_so_the_file_is_readable(self):
        svg = wireframe_svg(SHOW, "Halloween")
        assert "<title>Front door</title>" in svg
        assert 'id="Idle"' in svg

    def test_it_escapes_names_rather_than_emitting_broken_markup(self):
        show = json.loads(json.dumps(SHOW))
        show["scenes"][0]["surfaces"][0]["name"] = 'Door <script>&"'
        svg = wireframe_svg(show, "x")
        assert "<script>" not in svg
        assert "&lt;script&gt;" in svg

    def test_it_survives_a_show_with_no_geometry(self):
        svg = wireframe_svg({"output": {"width": 100, "height": 50}}, "empty")
        assert svg.startswith("<svg")
        assert svg.rstrip().endswith("</svg>")

    def test_a_non_numeric_coordinate_becomes_zero_not_nan(self):
        show = json.loads(json.dumps(SHOW))
        show["scenes"][0]["surfaces"][0]["corners"] = [
            ["x", 1],
            [2, 3],
            [4, 5],
            [6, 7],
        ]
        svg = wireframe_svg(show, "x")
        assert "NaN" not in svg
        assert "0,1" in svg


class TestFolderName:
    def test_it_strips_the_extension_and_keeps_the_name(self):
        assert safe_folder("Halloween 2026.aethermap") == "Halloween 2026"

    def test_it_refuses_separators_so_a_name_cannot_escape_the_folder(self):
        for hostile in ("../../etc/passwd", "a\\b", "a/b/c"):
            cleaned = safe_folder(hostile)
            assert "/" not in cleaned
            assert "\\" not in cleaned

    def test_it_falls_back_rather_than_producing_an_empty_folder(self):
        assert safe_folder("") == "Aether Map show"
        assert safe_folder(".aethermap") == "Aether Map show"

    def test_it_bounds_the_length(self):
        assert len(safe_folder("x" * 500)) <= 80


def test_wireframe_fits_independent_artboards():
    show = {**SHOW, "scenes": [
        {**SHOW["scenes"][0], "artboard": {"widthPx": 800, "heightPx": 1400}},
        {"id": "wide", "name": "Wide", "artboard": {"widthPx": 2400, "heightPx": 800}, "surfaces": []},
    ]}
    svg = wireframe_svg(show, "Artboards")
    assert 'viewBox="0 0 2400 1400"' in svg
    assert '10,20 110,20 110,120 10,120' in svg
