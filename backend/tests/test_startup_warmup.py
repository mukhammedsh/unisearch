import unittest
from contextlib import AsyncExitStack
from unittest.mock import Mock, patch

import app.main as main_module


class StartupWarmupTests(unittest.IsolatedAsyncioTestCase):
    async def test_startup_warmup_runs_in_background_thread(self):
        fake_thread = Mock()

        with patch.object(main_module, "AUTO_WARMUP_ON_STARTUP", True), patch.object(
            main_module.threading,
            "Thread",
            return_value=fake_thread,
        ) as thread_cls:
            async with AsyncExitStack() as stack:
                await stack.enter_async_context(main_module._lifespan(main_module.app))

        thread_cls.assert_called_once_with(
            target=main_module._run_startup_warmup,
            name="startup-warmup",
            daemon=True,
        )
        fake_thread.start.assert_called_once_with()

    async def test_startup_warmup_is_skipped_when_disabled(self):
        with patch.object(main_module, "AUTO_WARMUP_ON_STARTUP", False), patch.object(
            main_module.threading,
            "Thread",
        ) as thread_cls:
            async with AsyncExitStack() as stack:
                await stack.enter_async_context(main_module._lifespan(main_module.app))

        thread_cls.assert_not_called()


if __name__ == "__main__":
    unittest.main()
