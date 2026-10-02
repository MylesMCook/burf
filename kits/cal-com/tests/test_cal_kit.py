"""Unit tests for cal_kit.py's pure parts: python3 -m unittest discover -s tests"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
import cal_kit as k  # noqa: E402

MAIN = """# Cal.com
DATABASE_URL="postgresql://postgres:secret@localhost:5450/calendso?schema=public&connection_limit=5"
DATABASE_DIRECT_URL="postgresql://postgres:secret@localhost:5450/calendso"
NEXT_PUBLIC_WEBAPP_URL='http://localhost:3001'
NEXT_PUBLIC_EMBED_LIB_URL=http://localhost:3001/embed/embed.js # the embed
NEXT_PUBLIC_CAL_VIDEO_URL=http://localhost:3003
OLD_DEFAULT=http://localhost:3000/x?y=1
GOOGLE_API_CREDENTIALS='{"web":{"redirect_uris":["http://localhost:3001/cb"]}}'
MULTI="line one
line two"
export EXPORTED=yes
"""

ENV = {
    "BERTH_BOX": "devbox", "CAL_PUBLIC_BOX": "devl", "CAL_URL_PORT": "1377",
    "BERTH_LOCATION": "cal", "BERTH_WORKTREE_NAME": "fix-billing", "BERTH_WORKTREE_SLUG": "cal_fix_billing",
    "BERTH_WORKTREE_PATH": "/home/me/work/cal-fix-billing", "BERTH_PORT": "41010",
}


class ParseEnv(unittest.TestCase):
    def test_reads_quotes_comments_exports_and_multiline(self):
        e = k.parse_env(MAIN)
        self.assertEqual(e["NEXT_PUBLIC_WEBAPP_URL"], "http://localhost:3001")
        self.assertEqual(e["NEXT_PUBLIC_EMBED_LIB_URL"], "http://localhost:3001/embed/embed.js")
        self.assertEqual(e["MULTI"], "line one\nline two")
        self.assertEqual(e["EXPORTED"], "yes")
        self.assertTrue(e["GOOGLE_API_CREDENTIALS"].startswith('{"web"'))


class Updates(unittest.TestCase):
    def setUp(self):
        self.main = k.parse_env(MAIN)
        self.db, self.u = k.env_updates(self.main, self.main, ENV)

    def test_database_is_the_worktrees_on_the_same_server(self):
        self.assertEqual(self.db, "bcal_cal_fix_billing")
        self.assertEqual(self.u["DATABASE_URL"], "postgresql://postgres:secret@localhost:5450/bcal_cal_fix_billing?connection_limit=5")
        self.assertEqual(self.u["DATABASE_DIRECT_URL"], "postgresql://postgres:secret@localhost:5450/bcal_cal_fix_billing")

    def test_main_app_urls_point_at_the_worktree_and_others_do_not(self):
        origin = "http://fix-billing.cal.devl.localhost:1377"
        self.assertEqual(self.u["NEXT_PUBLIC_WEBAPP_URL"], origin)
        self.assertEqual(self.u["NEXT_PUBLIC_EMBED_LIB_URL"], origin + "/embed/embed.js")
        self.assertEqual(self.u["OLD_DEFAULT"], origin + "/x?y=1")
        self.assertEqual(self.u["NEXTAUTH_URL"], origin + "/api/auth")
        self.assertEqual(self.u["NEXTAUTH_URL_INTERNAL"], "http://127.0.0.1:41010/api/auth")
        self.assertEqual(self.u["PORT"], "41010")
        self.assertNotIn("NEXT_PUBLIC_CAL_VIDEO_URL", self.u)
        self.assertNotIn("GOOGLE_API_CREDENTIALS", self.u)

    def test_port_80_drops_the_port_and_the_box_falls_back_to_berths_name(self):
        env = dict(ENV, CAL_URL_PORT="80")
        del env["CAL_PUBLIC_BOX"]
        self.assertEqual(k.worktree_origin(env), "http://fix-billing.cal.devbox.localhost")

    def test_a_remote_database_is_refused(self):
        main = dict(self.main, DATABASE_URL="postgresql://u:p@db.example.com/cal", DATABASE_DIRECT_URL="")
        with self.assertRaises(k.KitError):
            k.env_updates(main, main, ENV)

    def test_a_name_that_cannot_be_a_hostname_is_refused(self):
        with self.assertRaises(k.KitError):
            k.worktree_origin(dict(ENV, CAL_PUBLIC_BOX="Dev Box"))


class SetEnv(unittest.TestCase):
    def test_replaces_in_place_and_appends_missing(self):
        out = k.set_env("A=1\nexport B=2\nC=3", {"B": "two", "D": "four"})
        self.assertEqual(out, 'A=1\nB="two"\nC=3\nD="four"\n')

    def test_round_trips_values_with_quotes(self):
        out = k.set_env("", {"X": 'say "hi"'})
        self.assertEqual(k.parse_env(out)["X"], 'say "hi"')


class Names(unittest.TestCase):
    def test_database_names_stay_valid_and_unique_when_long(self):
        long = "cal_" + "very_long_branch_name_" * 5
        a = k.database_name(long, "/a")
        b = k.database_name(long, "/b")
        self.assertLessEqual(len(a), 63)
        self.assertNotEqual(a, b)
        self.assertTrue(k.is_kit_database(a))

    def test_only_kit_names_count_as_kit_databases(self):
        for bad in ("calendso", "bcaltpl_abc", "bcal_", "bcal_x; DROP", "postgres", "calwt_0123456789ab"):
            self.assertFalse(k.is_kit_database(bad), bad)


class Context(unittest.TestCase):
    def test_the_main_checkout_is_refused(self):
        with self.assertRaises(k.KitError):
            k.context({"BERTH_ROOT_PATH": "/w/cal", "BERTH_WORKTREE_PATH": "/w/cal/"})

    def test_needs_berths_environment(self):
        with self.assertRaises(k.KitError):
            k.context({})


if __name__ == "__main__":
    unittest.main()
