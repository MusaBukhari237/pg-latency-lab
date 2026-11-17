import {parseCsv} from "./csv.mjs";
const decimal = text => /^[+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text);
export function importSamples(source, format, runName = "") {
  if (!source.trim()) throw Error("Paste a dataset to begin.");
  if (source.length > 1500000) throw Error("Use up to 1.5 MB of pasted data.");
  if (format === "pgbench") {
    if (!runName.trim() || runName.length > 80) throw Error("Enter a name for the pgbench run.");
    const values = [], ignored = {count:0};
    for (const [row, text] of source.trim().split(/\r?\n/).entries()) {
      if (!text.trim() || text.trimStart().startsWith("#")) continue;
      const fields = text.trim().split(/\s+/);
      if (fields.length < 6 || !/^\d+$/.test(fields[0]) || !/^\d+$/.test(fields[1]) || !/^\d+$/.test(fields[3]) || !/^\d{9,}$/.test(fields[4]) || !/^\d{1,6}$/.test(fields[5])) throw Error("Invalid pgbench transaction log line " + (row+1) + ".");
      if (/^(skipped|failed)/.test(fields[2])) { ignored.count++; continue; }
      if (!/^\d+$/.test(fields[2]) || !Number.isSafeInteger(Number(fields[2]))) throw Error("Expected transaction time in microseconds on line " + (row+1) + ".");
      values.push({run:runName.trim(),ms:Number(fields[2])/1000});
    }
    if (!values.length || values.length > 25000) throw Error("Use a log with between 1 and 25,000 measured transactions.");
    return {values,skipped:ignored.count};
  }
  if (format !== "csv") throw Error("Unsupported input format.");
  const {columns,records} = parseCsv(source);
  const index = columns.indexOf("run"), duration = columns.indexOf("duration_ms");
  if (index < 0 || duration < 0) throw Error("CSV must include run and duration_ms headers.");
  const values = records.map((row,i) => {
    const run = row[index].trim(), value = row[duration].trim(), ms = Number(value);
    if (!run || run.length > 80 || !decimal(value) || !Number.isFinite(ms) || ms > 1e9) throw Error("Invalid run name or duration on CSV record " + (i+2) + ".");
    return {run,ms};
  });
  if (!values.length) throw Error("The CSV has no measurements.");
  return {values,skipped:0};
}

function percentile(sorted, p) {
  const position = p * (sorted.length - 1);
  const index = Math.floor(position);
  return sorted[index] + (sorted[Math.min(index + 1, sorted.length - 1)] - sorted[index]) * (position - index);
}
export function summarize(values, baseline) {
  const groups = new Map();
  for (const row of values) {
    if (!groups.has(row.run)) groups.set(row.run,[]);
    groups.get(row.run).push(row.ms);
  }
  if (!groups.size || groups.size > 30) throw Error("Compare between 1 and 30 runs.");
  const result = [...groups].map(([run,times]) => {
    const sorted = times.toSorted((a,b)=>a-b);
    return {run,count:sorted.length,min:sorted[0],median:percentile(sorted,.5),p95:percentile(sorted,.95),p99:percentile(sorted,.99),max:sorted.at(-1)};
  });
  const reference = result.find(row=>row.run === baseline);
  if (baseline && !reference) throw Error("Pick a baseline from the loaded runs.");
  return result.map(row=>({...row,delta:reference?.p95 ? (row.p95/reference.p95 - 1)*100 : null}));
}
