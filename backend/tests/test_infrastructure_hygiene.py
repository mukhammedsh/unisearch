import os
import re
import unittest


class InfrastructureHygieneTests(unittest.TestCase):
    def setUp(self):
        # Locate the project root directory
        self.backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.root_dir = os.path.dirname(self.backend_dir)

    def test_no_absolute_paths_in_source_code(self):
        """Verify absence of hardcoded absolute paths (C:\\... or /home/...) in source code."""
        path_patterns = [
            re.compile(r'"[a-zA-Z]:\\[^"]+"'),
            re.compile(r"'[a-zA-Z]:\\[^']+'"),
            re.compile(r'"/(?:home|Users|usr|var|etc|opt)/[^"]+"'),
            re.compile(r"'/(?:home|Users|usr|var|etc|opt)/[^']+'"),
        ]

        exclusions = [
            "node_modules",
            ".git",
            ".claude",
            ".vscode",
            ".venv",
            "__pycache__",
            "test_infrastructure_hygiene.py",  # Exclude this test file itself
        ]

        invalid_files = []

        for root, dirs, files in os.walk(self.root_dir):
            # Filter out excluded directories
            dirs[:] = [d for d in dirs if d not in exclusions]

            for file in files:
                if not file.endswith((".py", ".js", ".mjs", ".html", ".css", ".json")):
                    continue
                if file in exclusions:
                    continue

                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                except (UnicodeDecodeError, FileNotFoundError):
                    continue

                for pattern in path_patterns:
                    matches = pattern.findall(content)
                    if matches:
                        relative_path = os.path.relpath(file_path, self.root_dir)
                        invalid_files.append((relative_path, matches))

        # Output readable error message if absolute paths are found
        if invalid_files:
            msg = "\n".join(
                f"File '{path}' contains absolute paths: {matches}"
                for path, matches in invalid_files
            )
            self.fail(f"Found hardcoded absolute paths in source code:\n{msg}")

    def test_env_example_contains_no_secrets(self):
        """Verify that .env.example contains no real secrets, passwords, or tokens."""
        env_example_path = os.path.join(self.root_dir, "backend", ".env.example")
        if not os.path.exists(env_example_path):
            env_example_path = os.path.join(self.root_dir, ".env.example")

        if not os.path.exists(env_example_path):
            self.skipTest(".env.example not found")

        with open(env_example_path, "r", encoding="utf-8") as f:
            content = f.read()

        suspicious_patterns = [
            (re.compile(r"=\s*[a-zA-Z0-9]{32,}\s*$", re.MULTILINE), "Long hash/token"),
            (re.compile(r"=\s*([a-zA-Z0-9_\-\.\+]+@[a-zA-Z0-9_\-\.]+)\s*$", re.MULTILINE), "Email address"),
            (re.compile(r"(?:password|pwd|secret|key|token|auth)\s*=\s*(?!your_|placeholder|demo|test|<|\[)[a-zA-Z0-9_]{6,}\s*$", re.MULTILINE | re.IGNORECASE), "Potential password/secret"),
        ]

        detected_issues = []
        for pattern, desc in suspicious_patterns:
            matches = pattern.findall(content)
            if matches:
                detected_issues.append(f"{desc}: {matches}")

        if detected_issues:
            self.fail("Suspicious values (secrets) detected in .env.example:\n" + "\n".join(detected_issues))

    def test_files_encoding_utf8_without_bom(self):
        """Verify that source code files use UTF-8 without BOM."""
        exclusions = ["node_modules", ".git", ".claude", ".vscode", ".venv", "__pycache__", "university_assets", "assets"]
        invalid_files = []

        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in exclusions]

            for file in files:
                if not file.endswith((".py", ".js", ".mjs", ".html", ".css", ".json")):
                    continue

                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "rb") as f:
                        first_bytes = f.read(4)
                except FileNotFoundError:
                    continue

                # UTF-8 BOM is EF BB BF
                if first_bytes.startswith(b"\xef\xbb\xbf"):
                    relative_path = os.path.relpath(file_path, self.root_dir)
                    invalid_files.append(relative_path)

        if invalid_files:
            self.fail("Files with UTF-8 BOM found; re-encode to UTF-8 without BOM:\n" + "\n".join(invalid_files))


if __name__ == "__main__":
    unittest.main()
