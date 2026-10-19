import { supabase } from "@/integrations/supabase/client";
import type { PredictionResult } from "./predict";
import { CLASS_INFO, CLASS_NAMES } from "./classes";
export async function savePrediction(userId:string,file:File,r:PredictionResult) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path=`${userId}/${crypto.randomUUID()}.${ext}`;
  const {error:uploadError}=await supabase.storage.from("ultrasound-scans").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError)throw uploadError;
  const {error}=await supabase.from("predictions").insert({user_id:userId,image_url:"",image_path:path,predicted_class:r.predicted_class,confidence:r.confidence,probabilities:{...r.probabilities,_meta:{model:r.model,weights_sha256:r.weights_sha256,source:r.source,elapsed_ms:r.elapsed_ms??null}},heatmap_url:r.heatmap_url??null});
  if(error){await supabase.storage.from("ultrasound-scans").remove([path]);throw error;}
}
export function downloadText(name:string,content:string,type="text/plain") {
 const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));}
export function downloadReport(r:PredictionResult,filename:string){
 const rows=CLASS_NAMES.map(c=>`<tr><td>${CLASS_INFO[c].label}</td><td>${(r.probabilities[c]*100).toFixed(2)}%</td></tr>`).join("");
 const heatmap=r.heatmap_url?.startsWith("data:image/png;base64,")?`<h2>Grad-CAM attention</h2><img alt="Model attention overlay" src="${r.heatmap_url}" width="224"/><p>Attention is not a lesion boundary or clinical explanation.</p>`:"";
 downloadText(`OvaScan-report-${r.created_at.slice(0,10)}.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><title>OvaScan research report</title><style>body{font:16px/1.7 system-ui;max-width:750px;margin:50px auto;padding:30px;color:#302039}h1{color:#743a62}h2{font-size:20px}table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd}small{overflow-wrap:anywhere}.note{background:#f6eef3;padding:20px}button{padding:10px 20px}@media print{button{display:none}body{margin:0}}</style><h1>OvaScan · Research report</h1><p>${escapeHtml(filename)}<br>${escapeHtml(new Date(r.created_at).toLocaleString())}</p><h2>${CLASS_INFO[r.predicted_class].label}</h2><p>Model score: <b>${(r.confidence*100).toFixed(2)}%</b></p><table>${rows}</table>${heatmap}<p class="note">Research and education only. This output is not a diagnosis. A softmax score is not a calibrated probability of disease. Review the original image with a qualified clinician for medical decisions.</p><small>Model: ${escapeHtml(r.model)}<br>Weights SHA-256: ${escapeHtml(r.weights_sha256)}</small><p><button onclick="window.print()">Print / Save as PDF</button></p></html>`,"text/html");
}
