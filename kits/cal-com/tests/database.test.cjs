// node --test tests/ : the database helper's pure parts.
const test = require("node:test");
const assert = require("node:assert");
const db = require("../scripts/database.cjs");

test("only bcal_ names are kit databases", () => {
  for (const ok of ["bcal_cal_fix_billing", "bcal_x"]) assert.ok(db.isKitDatabase(ok), ok);
  for (const bad of ["calendso", "postgres", "bcaltpl_abc", "bcal_", 'bcal_x"; DROP', "BCAL_X", "calwt_0123456789ab"]) assert.ok(!db.isKitDatabase(bad), bad);
});

test("templates are named by their migrations", () => {
  const a = db.templateName("localhost:5450", "calendso", "postgres", [["001", "abc"]], "");
  assert.match(a, /^bcaltpl_[0-9a-f]{20}$/);
  assert.equal(a, db.templateName("localhost:5450", "calendso", "postgres", [["001", "abc"]], ""));
  assert.notEqual(a, db.templateName("localhost:5450", "calendso", "postgres", [["001", "abd"]], ""));
});

test("the container publishing Postgres's port is found", () => {
  const ps = "qaitai-dev-postgres-1\t0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp\ndatabase-postgres-1\t0.0.0.0:5450->5432/tcp, [::]:5450->5432/tcp\n";
  assert.deepEqual(db.publishedPort(ps, "5450"), { name: "database-postgres-1", port: "5432" });
  assert.equal(db.publishedPort(ps, "5999"), null);
});

test("notes are quoted as SQL literals", () => {
  assert.equal(db.quoteLiteral("berth cal-com kit: /home/o'brien/w"), "'berth cal-com kit: /home/o''brien/w'");
});
