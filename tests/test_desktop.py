"""Portable launcher and optional-tool discovery regression tests."""
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'desktop'))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'worker'))
import launcher
import platform_tools


class DesktopTests(unittest.TestCase):
    def test_platform_profiles_are_user_owned(self):
        home = Path('/example/user')
        for platform, expected in [('win32','AppData/Local/ACE Studio'),
                                   ('darwin','Library/Application Support/ACE Studio'),
                                   ('linux','.config/ace-studio')]:
            config, state = launcher.user_paths(platform, home, {})
            self.assertIn(expected, config.as_posix())
            self.assertTrue(config.is_relative_to(home))
            self.assertTrue(state.is_relative_to(home))

    def test_explicit_profiles_are_preserved(self):
        config, state = launcher.user_paths('linux', Path('/user'),
                                          {'ACE_DESKTOP_CONFIG':'chosen config','ACE_DESKTOP_STATE':'chosen state'})
        self.assertEqual(config, Path('chosen config'))
        self.assertEqual(state, Path('chosen state'))

    def test_native_instance_lock_can_be_reacquired(self):
        with tempfile.TemporaryDirectory() as temporary:
            file = Path(temporary)/'launcher.lock'
            for attempt in range(2):
                with launcher.instance_lock(file):
                    self.assertTrue(file.is_file())

    def test_optional_overrides_require_real_files(self):
        with patch.dict(os.environ, {'ACE_SOFFICE':'missing-office-executable', 'ACE_GS':'missing-gs-executable'}):
            self.assertIsNone(platform_tools.office_executable())
            self.assertIsNone(platform_tools.ghostscript_executable())

    def test_profile_is_discovered_next_to_ghostscript(self):
        with tempfile.TemporaryDirectory() as temporary:
            prefix = Path(temporary)
            executable = prefix/'bin/gswin64c.exe'
            executable.parent.mkdir()
            executable.touch()
            profile = prefix/'iccprofiles/srgb.icc'
            profile.parent.mkdir()
            profile.touch()
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(Path(platform_tools.srgb_profile(executable)), profile)


if __name__ == '__main__':
    unittest.main()
