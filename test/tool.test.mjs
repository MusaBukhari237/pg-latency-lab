import test from "node:test";
import assert from "node:assert/strict";
import {importSamples,summarize} from "../docs/tool.mjs";
import {writeCsv} from "../docs/csv.mjs";
test("interpolates percentiles and measures changes relative to the chosen run",()=>{
  const {values}=importSamples("run,duration_ms\r\nBase,0\r\nBase,10\r\nNew,4\r\nNew,8","csv");
  const data=summarize(values,"Base");
  assert.equal(data[0].median,5);
  assert.equal(data[0].p95,9.5);
  assert.equal(data[1].p95,7.8);
  assert.ok(data[1].delta<0);
  assert.throws(()=>summarize(values,"missing"),/Pick a baseline/);
});
test("converts pgbench microseconds and rejects non-numeric values",()=>{
  const log=importSamples("0 1 1230 0 1794825500 420\n0 2 skipped 0 1794825500 500","pgbench","Local run");
  assert.deepEqual(log,{values:[{run:"Local run",ms:1.23}],skipped:1});
  assert.throws(()=>importSamples("run,duration_ms\nX,-2","csv"),/Invalid run/);
  assert.match(writeCsv([["=WEBSERVICE()"]]),/"'=WEBSERVICE\(\)"/);
});
