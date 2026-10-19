import { useEffect,useRef,useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ScanLine,UploadCloud,FileImage,X,ArrowRight,Layers,Database,Maximize,BrainCircuit,FileSearch,ShieldCheck,Info,BookOpen,Loader2,ChevronRight,Expand,Download } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { ConnectionDialog,useModelHealth } from "@/components/ConnectionDialog";
import { ResultPanel,Probabilities } from "./ResultPanel";
import { CLASS_NAMES,CLASS_INFO } from "@/lib/classes";
import { runPrediction,type PredictionResult } from "@/lib/predict";
import { savePrediction } from "@/lib/records";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
const SAMPLE={complex_cyst:.1119,dominant_follicle:.0001,healthy:.0002,poly_cyst:.0002,simple_cyst:.8877};
export function AnalysisWorkspace(){
 const {user}=useAuth();const cache=useQueryClient();const model=useModelHealth();
 const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState("");const [drag,setDrag]=useState(false);const [heatmap,setHeatmap]=useState(true);
 const [running,setRunning]=useState(false);const [result,setResult]=useState<PredictionResult|null>(null);const [error,setError]=useState("");const [connection,setConnection]=useState(false);const [sample,setSample]=useState(false);const [zoom,setZoom]=useState(false);const [saving,setSaving]=useState(false);const [saved,setSaved]=useState(false);
 const input=useRef<HTMLInputElement>(null);const controller=useRef<AbortController|null>(null);const selectionId=useRef(0);
 useEffect(()=>{if(!file){setPreview("");return;}const u=URL.createObjectURL(file);setPreview(u);return()=>URL.revokeObjectURL(u);},[file]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function choose(f?:File){
  if(!f||running||saving)return;setError("");
  if(!["image/jpeg","image/png","image/webp"].includes(f.type)){setError("Choose a JPG, PNG, or WebP image. DICOM and documents are not supported.");return;}
  if(f.size>10*1024*1024){setError("This image exceeds the 10 MB limit.");return;}
  const id=++selectionId.current;
  try {const bitmap=await createImageBitmap(f);const tooLarge=bitmap.width*bitmap.height>20_000_000;bitmap.close();if(tooLarge)throw new Error("Image dimensions exceed 20 megapixels.");if(id!==selectionId.current)return;setFile(f);setResult(null);setSaved(false);}catch(e){if(id===selectionId.current)setError(e instanceof Error&&e.message.includes("20 megapixels")?e.message:"This file could not be opened as an image.");}
 }
 function reset(){selectionId.current++;setFile(null);setResult(null);setSaved(false);setError("");if(input.current)input.current.value="";}
 async function analyze(){if(!file||running)return;setRunning(true);setError("");setResult(null);setSaved(false);controller.current=new AbortController();try{setResult(await runPrediction(file,heatmap,controller.current.signal));}catch(e){if(controller.current?.signal.aborted)setError("Analysis cancelled. Your image is still available to try again.");else setError(e instanceof Error?e.message:"Analysis failed. Please try again.");}finally{setRunning(false);controller.current=null;}}
 async function save(){if(!user||!file||!result||saved)return;setSaving(true);try{await savePrediction(user.id,file,result);setSaved(true);cache.invalidateQueries({queryKey:["predictions"]});toast.success("Saved to your private scan history");}catch(e){toast.error(e instanceof Error?e.message:"Saving failed. Your result is still available to download.");}finally{setSaving(false);}}
 const ready=model.data?.status==="ready";
 return <SiteShell><div className="page-heading"><div><div className="eyebrow">A clearer view, one scan at a time</div><h1>Ultrasound analysis</h1><p>Explore ovarian ultrasound images with your trained deep learning model.</p></div><span className="pill"><BrainCircuit size={14}/>EfficientNet-B3</span></div>
 <div className="stats-row">{[{icon:Database,value:"6,876",label:"Images in notebook"},{icon:Layers,value:"5 classes",label:"Ovarian image categories"},{icon:Maximize,value:"224 × 224",label:"Model input · RGB"},{icon:BrainCircuit,value:"8 models",label:"Compared in research"}].map(s=><div className="stat" key={s.label}><span className="stat-icon"><s.icon size={19}/></span><div><strong>{s.value}</strong><small>{s.label}</small></div></div>)}</div>
 <div className="work-grid"><div><section className="panel"><div className="panel-head"><div className="panel-title"><span className="step-num">01</span><h2>Upload ultrasound</h2></div><small>JPG, PNG, WEBP</small></div><div className="panel-body">
 <div className={`dropzone ${drag?"dragover":""} ${preview?"has-image":""}`} onDragOver={e=>{e.preventDefault();if(!running)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files[0]);}}>
 {preview?<img src={preview} alt="Selected ultrasound for analysis"/>:<><span className="upload-symbol"><UploadCloud size={27} strokeWidth={1.4}/></span><h3>Drop your ultrasound image here</h3><p>or choose a file from your device</p></>}
 {!preview&&<button className="browse" onClick={()=>input.current?.click()}>Browse files</button>}{!preview&&<p className="file-types">UP TO 10 MB · ONE IMAGE AT A TIME</p>}
 <input ref={input} className="sr-only" aria-label="Upload ultrasound image" type="file" accept="image/jpeg,image/png,image/webp" disabled={running||saving} onChange={e=>choose(e.target.files?.[0])}/></div>
 {file&&<div className="file-meta"><FileImage size={15}/><span>{file.name} · {(file.size/1024/1024).toFixed(2)} MB</span><button disabled={running||saving} aria-label="Remove image" onClick={reset}><X size={16}/></button><button aria-label="Enlarge image" onClick={()=>setZoom(true)}><Expand size={16}/></button></div>}
 <div className="check-row"><Checkbox id="heatmap" checked={heatmap} disabled={running||saving} onCheckedChange={v=>setHeatmap(v===true)}/><label htmlFor="heatmap">Include Grad-CAM attention map</label><Info size={13} aria-hidden="true"/></div>
 <Button className="run-button" disabled={!file||!ready||running||saving} onClick={analyze}>{running?<Loader2 size={16} className="animate-spin"/>:<ScanLine size={16}/>} {running?"Analyzing your image…":"Analyze ultrasound"}{!running&&<ArrowRight size={15}/>}</Button>
 {running&&<Button variant="ghost" className="w-full mt-2" onClick={()=>controller.current?.abort()}>Cancel analysis</Button>}
 <div className="supporting-note"><ShieldCheck size={12}/>Your image stays on this device until you run analysis.</div>
 {!ready&&<div className="status-notice"><Info size={14}/><span>{model.data?.status==="missing_weights"?"The model service needs your trained weights.":"Live analysis is waiting for your trained model."} <button onClick={()=>setConnection(true)}>Connection details</button></span></div>}
 {ready&&model.data?.requires_auth&&!user&&<div className="status-notice"><Info size={14}/><span>This model service requires an account. <Link to="/auth" className="underline">Sign in</Link> before analyzing.</span></div>}
 {error&&<div className="error-box" role="alert">{error}</div>}
 </div></section><div className="class-strip"><div className="section-label">FIVE RESEARCH CATEGORIES</div><div className="class-chips">{CLASS_NAMES.map(c=><span className="class-chip" key={c}><i style={{background:CLASS_INFO[c].tone}}/>{CLASS_INFO[c].label}</span>)}</div></div></div>
 <section className="panel" aria-live="polite" aria-busy={running}><div className="panel-head"><div className="panel-title"><span className="step-num">02</span><h2>Analysis report</h2></div><FileSearch size={17} color="#b3a2ba"/></div>
 {running?<div className="loading-state"><Loader2 size={32} className="animate-spin"/><strong>Reading image features</strong><p>Running your model{heatmap?" and generating attention map":""}…</p></div>:result?<ResultPanel result={result} filename={file?.name||"Ultrasound"} onSave={user?save:undefined} saving={saving} saved={saved}/>:<div className="report-empty"><span className="empty-icon"><FileSearch size={31} strokeWidth={1.1}/></span><h3>Your insights will appear here</h3><p>Upload an image and run analysis to see the predicted class, scores, and model attention.</p><div className="report-steps"><b>Upload</b><ChevronRight size={11}/><b>Analyze</b><ChevronRight size={11}/><b>Review</b></div></div>}
 {result&&!user&&<div className="reference-row"><span>Keep this result in your account.</span><Link to="/auth">Sign in to save</Link></div>}
 <div className="reference-row"><span>Curious about the output?</span><button onClick={()=>setSample(true)}>View notebook example <ArrowUpRightIcon/></button></div></section></div>
 <div className="below-grid"><div className="model-card"><span className="soft-icon"><BookOpen size={23}/></span><div><h3>Grounded in your research.</h3><p>Explore model comparisons, training settings,<br className="hidden xl:block"/> and the results recorded in your notebook.</p></div><Link to="/research" aria-label="View research"><ArrowRight size={19}/></Link></div><div className="privacy-card"><ShieldCheck size={20}/><div><strong>Designed for research, handled with care.</strong><p>Use de-identified images. Live analysis sends your image to the connected model service. Saving to your account is optional.</p></div></div></div>
 <ConnectionDialog open={connection} onOpenChange={setConnection}/>
 <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="sample-dialog"><DialogHeader><DialogTitle>Image preview</DialogTitle><DialogDescription>{file?.name}</DialogDescription></DialogHeader>{preview&&<img src={preview} alt="Full ultrasound preview" className="max-h-[70vh] w-full object-contain"/>}</DialogContent></Dialog>
 <Dialog open={sample} onOpenChange={setSample}><DialogContent className="sample-dialog"><DialogHeader><DialogTitle>A result from your notebook</DialogTitle><DialogDescription>Recorded output from the real-time prediction cell in the uploaded training notebook.</DialogDescription></DialogHeader><div className="sample-notice">Saved reference example · Not a prediction of your uploaded image.</div><div className="sample-grid"><div className="sample-image"><img src="/research/reference-prediction.png" alt="Recorded class probability plot from the supplied notebook"/></div><div><div className="result-label">Recorded model output</div><div className="result-top"><h3>Simple cyst</h3><strong>88.77%</strong></div><Probabilities probabilities={SAMPLE} top="simple_cyst"/><p className="metric-caption">Rounded scores as printed in the notebook; total may differ slightly from 100%.</p></div></div></DialogContent></Dialog>
 </SiteShell>;
}
function ArrowUpRightIcon(){return <ArrowRight size={12} style={{transform:"rotate(-35deg)"}}/>;}
