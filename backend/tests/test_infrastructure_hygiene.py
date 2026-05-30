import os
import re
import unittest


class InfrastructureHygieneTests(unittest.TestCase):
    def setUp(self):
        # Находим корневую директорию проекта
        self.backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.root_dir = os.path.dirname(self.backend_dir)

    def test_no_absolute_paths_in_source_code(self):
        """Проверяет отсутствие жестко захардкоженных абсолютных путей (C:\\... или /home/...) в исходном коде."""
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
            "test_infrastructure_hygiene.py",  # Исключаем сам этот файл
        ]

        invalid_files = []

        for root, dirs, files in os.walk(self.root_dir):
            # Фильтруем исключенные директории
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

        # Выводим понятную ошибку, если найдены абсолютные пути
        if invalid_files:
            msg = "\n".join(
                f"Файл '{path}' содержит абсолютные пути: {matches}"
                for path, matches in invalid_files
            )
            self.fail(f"Найдены захардкоженные абсолютные пути в исходном коде:\n{msg}")

    def test_env_example_contains_no_secrets(self):
        """Проверяет, что .env.example не содержит реальных секретов, паролей или токенов."""
        env_example_path = os.path.join(self.root_dir, "backend", ".env.example")
        if not os.path.exists(env_example_path):
            env_example_path = os.path.join(self.root_dir, ".env.example")

        if not os.path.exists(env_example_path):
            self.skipTest(".env.example не найден")

        with open(env_example_path, "r", encoding="utf-8") as f:
            content = f.read()

        suspicious_patterns = [
            (re.compile(r"=\s*[a-zA-Z0-9]{32,}\s*$", re.MULTILINE), "Длинный хэш/токен"),
            (re.compile(r"=\s*([a-zA-Z0-9_\-\.\+]+@[a-zA-Z0-9_\-\.]+)\s*$", re.MULTILINE), "Email адрес"),
            (re.compile(r"(?:password|pwd|secret|key|token|auth)\s*=\s*(?!your_|placeholder|demo|test|<|\[)[a-zA-Z0-9_]{6,}\s*$", re.MULTILINE | re.IGNORECASE), "Потенциальный пароль/секрет"),
        ]

        detected_issues = []
        for pattern, desc in suspicious_patterns:
            matches = pattern.findall(content)
            if matches:
                detected_issues.append(f"{desc}: {matches}")

        if detected_issues:
            self.fail(f"В .env.example обнаружены подозрительные значения (секреты):\n" + "\n".join(detected_issues))

    def test_files_encoding_utf8_without_bom(self):
        """Проверяет, что файлы исходного кода используют UTF-8 без BOM."""
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

                # UTF-8 BOM - это EF BB BF
                if first_bytes.startswith(b"\xef\xbb\xbf"):
                    relative_path = os.path.relpath(file_path, self.root_dir)
                    invalid_files.append(relative_path)

        if invalid_files:
            self.fail(f"Найдены файлы с BOM (UTF-8-BOM), перекодируйте их в UTF-8 без BOM:\n" + "\n".join(invalid_files))


if __name__ == "__main__":
    unittest.main()
