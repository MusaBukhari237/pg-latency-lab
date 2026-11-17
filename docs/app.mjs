const el=id=>document.getElementById(id), output=()=>el("result");
let urls=[];
function show(message) {
  for(const url of urls) URL.revokeObjectURL(url);
  urls=[];
  output().replaceChildren();
  const summary=document.createElement("p");
  summary.className="result-summary";
  summary.setAttribute("aria-live","polite");
  summary.textContent=message;
  output().append(summary);
}
function paragraph(text) {
  const p=document.createElement("p");
  p.textContent=text;
  output().append(p);
}
function run(callback) {
  el("run").onclick=async()=>{
    el("run").disabled=true;
    try{await callback();}catch(error){show(error.message);}
    finally{el("run").disabled=false;}
  };
}
function options(id,values,first=null) {
  const select=el(id);
  select.replaceChildren();
  if(first!==null) select.add(new Option(first,""));
  for(const value of values) select.add(new Option(value,value));
}
function table(rows) {
  const wrap=document.createElement("div"), data=document.createElement("table"), head=data.createTHead(), body=data.createTBody();
  wrap.className="table-wrap";
  rows.forEach((row,index)=>{
    const tr=(index?body:head).insertRow();
    for(const value of row){
      const cell=document.createElement(index?"td":"th");
      cell.textContent=String(value??"—");
      if(!index)cell.scope="col";
      tr.append(cell);
    }
  });
  wrap.append(data); output().append(wrap);
}
function bars(rows,description) {
  const figure=document.createElement("figure"), title=document.createElement("figcaption");
  title.textContent=description;
  figure.append(title);
  const max=rows.reduce((value,[,sample])=>Math.max(value,Math.abs(sample)),0)||1;
  for(const [label,value] of rows){
    const row=document.createElement("div"), name=document.createElement("span"), meter=document.createElement("meter"), amount=document.createElement("span");
    row.className="bar";
    name.textContent=label||"(blank)";
    amount.textContent=Number(value.toPrecision(8)).toLocaleString("en");
    meter.value=Math.abs(value);
    meter.max=max;
    meter.setAttribute("aria-label",name.textContent+" magnitude");
    row.append(name,meter,amount);
    figure.append(row);
  }
  output().append(figure);
}
function download(name,contents,type) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  urls.push(url);
  const anchor=document.createElement("a");
  anchor.className="button quiet export";
  anchor.textContent="Download "+name;
  anchor.download=name;
  anchor.href=url;
  output().append(anchor);
}
import {importSamples,summarize} from "./tool.mjs";
import {writeCsv} from "./csv.mjs";
let measurements=null;
const format=value=>Number(value.toFixed(3));
function draw(){
  if(!measurements) return;
  const stats=summarize(measurements.values,el("baseline").value);
  show(stats.length+" runs · "+measurements.values.length+" measured samples · "+measurements.skipped+" skipped or failed");
  const rows=[["Run","Samples","Min ms","p50 ms","p95 ms","p99 ms","Max ms","p95 vs baseline %"],
    ...stats.map(x=>[x.run,x.count,format(x.min),format(x.median),format(x.p95),format(x.p99),format(x.max),x.delta===null?"":format(x.delta)])];
  table(rows);
  bars(stats.map(row=>[row.run,row.p95]),"p95 milliseconds");
  download("latency-summary.csv",writeCsv(rows),"text/csv");
}
el("sample").onclick=()=>{
  el("format").value="csv";
  const series={"Baseline":[4.1,4.2,5.3,6.0,7.4,9.9,18.5,23.7],"Candidate":[2.1,3.8,4.5,5.2,6.4,7.9,10.8,12.4]};
  el("source").value="run,duration_ms\n"+Object.entries(series).flatMap(([name,values])=>values.map(value=>name+","+value)).join("\n");
};
el("baseline").onchange=()=>{if(measurements)draw();};
run(()=>{
  measurements=null;
  const next=importSamples(el("source").value,el("format").value,el("label").value);
  const names=summarize(next.values).map(row=>row.run);
  const previous=el("baseline").value;
  options("baseline",names);
  if(names.includes(previous)) el("baseline").value=previous;
  measurements=next;
  draw();
});
