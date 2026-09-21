import ast
import os
import unittest


class CodeHygieneTests(unittest.TestCase):
    """
    Architecture & Anti-Vibecoding guardrail tests for backend Python code.
    Ensures explicit error handling, prevents silent exception swallowing,
    and blocks dangerous broad/bare except clauses across backend/app/.
    """

    @classmethod
    def setUpClass(cls):
        cls.backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.app_dir = os.path.join(cls.backend_root, "app")

    def _walk_app_python_files(self):
        for root, _, files in os.walk(self.app_dir):
            for file in files:
                if file.endswith(".py"):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.backend_root).replace("\\", "/")
                    yield full_path, rel_path

    def test_no_bare_except_clauses(self):
        """Disallows bare 'except:' clauses across all backend application code."""
        violations = []
        for full_path, rel_path in self._walk_app_python_files():
            with open(full_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=full_path)

            for node in ast.walk(tree):
                if isinstance(node, ast.Try):
                    for handler in node.handlers:
                        if handler.type is None:
                            violations.append(
                                f"{rel_path}:{handler.lineno} Bare 'except:' is forbidden. Specify explicit exception class."
                            )

        self.assertEqual(
            violations,
            [],
            f"Found bare except clauses violating AGENTS.md Rule 6:\n" + "\n".join(violations),
        )

    def test_no_base_exception_catches(self):
        """Disallows catching 'BaseException', which traps KeyboardInterrupt, SystemExit, etc."""
        violations = []
        for full_path, rel_path in self._walk_app_python_files():
            with open(full_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=full_path)

            for node in ast.walk(tree):
                if isinstance(node, ast.Try):
                    for handler in node.handlers:
                        if isinstance(handler.type, ast.Name) and handler.type.id == "BaseException":
                            violations.append(
                                f"{rel_path}:{handler.lineno} Catching BaseException is forbidden. Use Exception or a specific subclass."
                            )

        self.assertEqual(
            violations,
            [],
            f"Found BaseException catches:\n" + "\n".join(violations),
        )

    def test_no_silent_broad_exception_pass(self):
        """Disallows broad 'except Exception:' with only 'pass' that silently swallows errors."""
        violations = []
        for full_path, rel_path in self._walk_app_python_files():
            with open(full_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=full_path)

            for node in ast.walk(tree):
                if isinstance(node, ast.Try):
                    for handler in node.handlers:
                        is_broad = False
                        if isinstance(handler.type, ast.Name) and handler.type.id == "Exception":
                            is_broad = True
                        elif handler.type is None:
                            is_broad = True

                        if is_broad:
                            # Check if body is just `pass` or ellipsis
                            if len(handler.body) == 1:
                                stmt = handler.body[0]
                                if isinstance(stmt, ast.Pass):
                                    violations.append(
                                        f"{rel_path}:{handler.lineno} 'except Exception: pass' silently swallows errors without logging or fallback."
                                    )
                                elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and stmt.value.value is Ellipsis:
                                    violations.append(
                                        f"{rel_path}:{handler.lineno} 'except Exception: ...' silently swallows errors without logging or fallback."
                                    )

        self.assertEqual(
            violations,
            [],
            f"Found silent broad except clauses violating AGENTS.md Rule 6:\n" + "\n".join(violations),
        )


if __name__ == "__main__":
    unittest.main()
