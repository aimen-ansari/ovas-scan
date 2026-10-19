// Source-level contract checks are in backend/tests; this smoke check is for a running service.
const base=process.argv[2]||'http://127.0.0.1:8000';
const response=await fetch(`${base}/api/health`);
if(!response.ok)throw new Error(`Health request failed: ${response.status}`);
const result=await response.json();
console.log(JSON.stringify(result,null,2));
if(result.status!=='ready')process.exitCode=1;
