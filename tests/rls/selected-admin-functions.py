"""Run selected admin function regressions against an isolated local PostgreSQL.

Usage: python3 tests/rls/selected-admin-functions.py
Creates no production data; the temporary database is stopped and removed afterward.
"""
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SQL = (ROOT / "drizzle/migrations/0293_secure_selected_admin_product_functions.sql").read_text()
assert not re.search(r"\bEXECUTE\s+(?:format|')", SQL, re.I)

work = Path(tempfile.mkdtemp(prefix="selected-admin-functions-", dir="/tmp"))
os.chmod(work, 0o777)
prefix = ["setpriv", "--reuid=1000", "--regid=1000", "--clear-groups", "--"] if os.getuid() == 0 else []

def command(*args):
    result = subprocess.run([*prefix, *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout

# The isolated fixture contains every static restore column, with native types
# for fields used by price-save logic; remaining fields are opaque sample text.
columns = re.search(r"UPDATE public.designer_curator_picks t SET\s*\((.*?)\) =", SQL, re.S).group(1).split(", ")
types = {"designer_id": "uuid", "trade_price_cents": "integer", "price_per_sqm_cents": "integer", "size_variants": "jsonb"}
ddl = ", ".join(f"{name} {types.get(name, 'text')}" for name in columns)
setup = f"""
CREATE SCHEMA auth;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
CREATE FUNCTION public.has_role(_id uuid, _role text) RETURNS boolean LANGUAGE sql AS
$$ SELECT _id='00000000-0000-0000-0000-000000000001'::uuid AND _role='admin' $$;
CREATE TABLE public.designer_curator_picks (id uuid PRIMARY KEY, created_at timestamptz, {ddl});
CREATE TABLE public.admin_price_save_attempts (
 id uuid PRIMARY KEY, user_id uuid, product_id uuid, field_name text,
 old_data jsonb, new_data jsonb, status text DEFAULT 'Saving', error_code text, completed_at timestamptz);
CREATE TABLE public.content_audit_log (id uuid, table_name text, operation text, old_data jsonb, new_data jsonb);
"""
checks = """
DO $$
DECLARE
 admin_id uuid := '00000000-0000-0000-0000-000000000001';
 outsider_id uuid := '00000000-0000-0000-0000-000000000002';
 product_id uuid := '00000000-0000-0000-0000-000000000003';
 attempt_id uuid := '00000000-0000-0000-0000-000000000004';
 audit_id uuid := '00000000-0000-0000-0000-000000000005';
 field text; value jsonb; result jsonb; before_row jsonb; after_row jsonb;
BEGIN
 IF has_function_privilege('anon','public.commit_admin_price_save(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.restore_curator_pick_version(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous execute access';
 END IF;
 -- Missing identity and ordinary members must fail before looking up any row.
 FOREACH field IN ARRAY ARRAY['', outsider_id::text] LOOP
  PERFORM set_config('test.user_id',field,false);
  BEGIN
   PERFORM public.commit_admin_price_save(attempt_id);
   RAISE EXCEPTION 'Unauthorized price commit accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   PERFORM public.restore_curator_pick_version(audit_id);
   RAISE EXCEPTION 'Unauthorized restore accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 PERFORM set_config('test.user_id',admin_id::text,false);
 INSERT INTO public.designer_curator_picks(id,title,created_at) VALUES(product_id,'Original','2026-01-01');
 -- Every allowed price field writes exactly itself, ignoring unrelated JSON.
 FOREACH field IN ARRAY ARRAY['trade_price_cents','price_per_sqm_cents','size_variants','currency','price_prefix'] LOOP
  value := CASE field WHEN 'trade_price_cents' THEN '12345'::jsonb
   WHEN 'price_per_sqm_cents' THEN '23456'::jsonb
   WHEN 'size_variants' THEN '[{"label":"Large","price_cents":999}]'::jsonb
   WHEN 'currency' THEN '"EUR"'::jsonb ELSE '"From"'::jsonb END;
  SELECT to_jsonb(p) INTO before_row FROM public.designer_curator_picks p WHERE id=product_id;
  INSERT INTO public.admin_price_save_attempts(id,user_id,product_id,field_name,old_data,new_data)
   VALUES(attempt_id,admin_id,product_id,field,before_row,jsonb_build_object(field,value,'title','Injected'));
  result := public.commit_admin_price_save(attempt_id);
  IF result->>'status' <> 'Saved' THEN RAISE EXCEPTION 'Price field failed: % %',field,result; END IF;
  SELECT to_jsonb(p) INTO after_row FROM public.designer_curator_picks p WHERE id=product_id;
  IF after_row->field IS DISTINCT FROM value OR (after_row-field) IS DISTINCT FROM (before_row-field) THEN
   RAISE EXCEPTION 'Wrong field modified: %',field;
  END IF;
  IF public.commit_admin_price_save(attempt_id)->>'status' <> 'Saved' THEN RAISE EXCEPTION 'Retry failed'; END IF;
  DELETE FROM public.admin_price_save_attempts WHERE id=attempt_id;
 END LOOP;
 -- Stored attempts cannot broaden the field allowlist.
 INSERT INTO public.admin_price_save_attempts(id,user_id,product_id,field_name,old_data,new_data)
 VALUES(attempt_id,admin_id,product_id,'title',after_row,'{"title":"Injected"}');
 result := public.commit_admin_price_save(attempt_id);
 IF result->>'status' <> 'Failed' OR result->>'error_code' <> '22023' THEN RAISE EXCEPTION 'Unsupported field accepted'; END IF;
 DELETE FROM public.admin_price_save_attempts WHERE id=attempt_id;
 -- Optimistic conflict check must retain the current price.
 INSERT INTO public.admin_price_save_attempts(id,user_id,product_id,field_name,old_data,new_data)
 VALUES(attempt_id,admin_id,product_id,'currency','{"currency":"USD"}','{"currency":"GBP"}');
 result := public.commit_admin_price_save(attempt_id);
 IF result->>'error_code' <> '40001' THEN RAISE EXCEPTION 'Conflict not detected'; END IF;
 DELETE FROM public.admin_price_save_attempts WHERE id=attempt_id;
 -- A different account's attempt is unavailable even to an administrator.
 INSERT INTO public.admin_price_save_attempts(id,user_id,product_id,field_name,old_data,new_data)
 VALUES(attempt_id,outsider_id,product_id,'currency',after_row,'{"currency":"GBP"}');
 BEGIN
  PERFORM public.commit_admin_price_save(attempt_id);
  RAISE EXCEPTION 'Another account attempt accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Save attempt unavailable' THEN RAISE; END IF;
 END;
 -- Partial history preserves absent fields/creation time and treats SQL-like
 -- strings as data; explicit nulls still restore correctly.
 INSERT INTO public.content_audit_log(id,table_name,operation,new_data)
 VALUES(audit_id,'designer_curator_picks','UPDATE',jsonb_build_object('id',product_id,'title','x''; DROP TABLE nope; --','materials',NULL,'created_at','2020-01-01'));
 IF public.restore_curator_pick_version(audit_id) <> product_id THEN RAISE EXCEPTION 'Wrong restored identity'; END IF;
 SELECT to_jsonb(p) INTO after_row FROM public.designer_curator_picks p WHERE id=product_id;
 IF after_row->>'title' <> 'x''; DROP TABLE nope; --' OR after_row->>'currency' <> 'EUR'
 OR after_row->>'materials' IS NOT NULL OR after_row->>'created_at' NOT LIKE '2026-01-01%' THEN
  RAISE EXCEPTION 'Partial restoration changed absent fields';
 END IF;
 -- Deleted products can still be restored from the saved full snapshot.
 UPDATE public.content_audit_log SET operation='DELETE', old_data=after_row, new_data=NULL WHERE id=audit_id;
 DELETE FROM public.designer_curator_picks WHERE id=product_id;
 PERFORM public.restore_curator_pick_version(audit_id);
 IF NOT EXISTS(SELECT 1 FROM public.designer_curator_picks WHERE id=product_id) THEN RAISE EXCEPTION 'Deleted restore failed'; END IF;
 RAISE NOTICE 'All selected admin function regressions passed';
END $$;
"""
started = False
try:
    command("initdb", "-D", str(work / "data"), "-U", "test_admin", "-A", "trust", "--no-locale")
    command("pg_ctl", "-D", str(work / "data"), "-l", str(work / "server.log"), "-o", f"-k {work} -c listen_addresses=''", "-w", "start")
    started = True
    script = work / "checks.sql"
    script.write_text(setup + SQL + checks)
    result = subprocess.run([*prefix, "psql", "-h", str(work), "-U", "test_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", str(script)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    print(result.stderr.strip())
finally:
    if started:
        command("pg_ctl", "-D", str(work / "data"), "-m", "immediate", "-w", "stop")
    shutil.rmtree(work)