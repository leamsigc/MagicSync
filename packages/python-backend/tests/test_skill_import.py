"""T40.1 — skill import quarantine validation (PRD-SKILLS-AGENTS §5)."""

import io
import zipfile

from app.services.skills.tools import validate_skill_archive


def _zip(files: dict) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buffer.getvalue()


GOOD = {
    "research/SKILL.md": "---\nname: research\n---\nCite sources.",
    "research/notes.txt": "hello",
}


class TestSkillArchiveValidation:
    def test_valid_archive_passes(self):
        assert validate_skill_archive(_zip(GOOD)) is None

    def test_oversize_archive_rejected(self):
        big = dict(GOOD)
        big["research/blob.txt"] = "x" * (1024 * 1024 + 1)
        assert "too large" in (validate_skill_archive(_zip(big)) or "")

    def test_too_many_files_rejected(self):
        many = {f"research/f{i}.txt": "x" for i in range(101)}
        assert "too many" in (validate_skill_archive(_zip(many)) or "")

    def test_traversal_rejected(self):
        evil = dict(GOOD)
        evil["../evil.txt"] = "x"
        assert "Unsafe" in (validate_skill_archive(_zip(evil)) or "")

    def test_install_script_rejected(self):
        evil = dict(GOOD)
        evil["research/setup.py"] = "import os"
        assert "not allowed" in (validate_skill_archive(_zip(evil)) or "")

    def test_bad_extension_rejected(self):
        evil = dict(GOOD)
        evil["research/run.exe"] = "x"
        assert "not allowed" in (validate_skill_archive(_zip(evil)) or "")

    def test_corrupt_zip_rejected(self):
        assert validate_skill_archive(b"not a zip") is not None
