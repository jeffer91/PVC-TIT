const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {createHash,randomUUID}=require("node:crypto");
const {logger}=require("firebase-functions");
const db=getFirestore(initializeApp({projectId:"utet-4387a"}));
const titlesDb=getFirestore(initializeApp({projectId:"titulos-ec2fa"},"titulos"));
const keys=["estado","estadoProceso","validadoCoordinador","resultadoCoordinador","resultadoInvestigacion","requiereAccionDe","periodoId","periodoCanonicoId","periodoNombre","tituloFinal","tituloFinalInvestigacion","titulo1","titulo2","titulo3","tituloCoordinador","comentarioCoordinador","observacionInvestigacion","ultimoComentario","observacion","observacionDevolucion","ultimaFechaRevision","fechaEnvio","actualizadoEn"];
const pick=e=>Object.fromEntries(keys.map(k=>[k,typeof e[k]==="boolean"?e[k]:typeof e[k]==="string"?e[k]:""]));
const codeFor=e=>e?.code===7||String(e?.code||"").includes("permission")?"PERMISOS":e?.code===9?"INDICE":"CONSULTA";
async function throttle(ip){
 if(!ip)throw new HttpsError("unavailable","Origen no verificable");
 const bucket=Math.floor(Date.now()/60000),day=Math.floor(Date.now()/86400000);
 const refs=[bucket,day].map((v,i)=>db.collection("_pvcTitRateLimits").doc(createHash("sha256").update("pvc-tit:"+ip+":"+(i?"d":"m")+v).digest("hex")));
 await db.runTransaction(async t=>{
  const snaps=await Promise.all(refs.map(r=>t.get(r)));
  const limits=[5,30];
  if(snaps.some((s,i)=>(s.data()?.count||0)>=limits[i]))throw new HttpsError("resource-exhausted","Límite alcanzado");
  refs.forEach((r,i)=>t.set(r,{count:(snaps[i].data()?.count||0)+1,expireAt:new Date(Date.now()+(i?172800000:120000))}));
 });
}
exports.consultarFicha=onCall({region:"us-central1",cors:["https://jeffer91.github.io"],maxInstances:10,timeoutSeconds:20},async req=>{
 const cedula=String(req.data?.cedula||"").trim();
 if(!/^\d{10}$/.test(cedula))throw new HttpsError("invalid-argument","Cédula inválida");
 const trace=randomUUID().slice(0,8),issues=[];
 const note=(phase,e)=>{const id=codeFor(e);issues.push({fase:phase,codigo:id});logger.error("PVC-TIT fase fallida",{trace,phase,code:e?.code||"",message:e?.message||""});};
 try{await throttle(req.rawRequest.ip);}catch(e){if(e instanceof HttpsError)throw e;note("control",e);throw new HttpsError("unavailable","Servicio no disponible");}
 const tasks=await Promise.allSettled([
  db.collection("Estudiante").doc(cedula).get(),
  db.collection("matriculas").orderBy("localId").startAt(cedula+"__").endAt(cedula+"__\uf8ff").limit(100).get(),
  titlesDb.collection("envios").where("cedula","==",cedula).limit(30).get()
 ]);
 ["Estudiante","matriculas","envios"].forEach((name,i)=>{if(tasks[i].status==="rejected")note(name,tasks[i].reason);});
 const studentDoc=tasks[0].status==="fulfilled"?tasks[0].value:null;
 const student=studentDoc?.exists&&studentDoc.data()?.eliminado!==true?studentDoc.data():null;
 const matriculas=tasks[1].status==="fulfilled"?tasks[1].value.docs.map(x=>x.data()).filter(x=>x.retirado!==true).sort((a,b)=>String(b.periodoId||"").localeCompare(String(a.periodoId||""))):[];
 const selected=matriculas.find(x=>student&&String(x.nombreCarrera||"").trim().toUpperCase()===String(student.nombreCarreraActual||"").trim().toUpperCase())||matriculas[0];
 const envios=tasks[2].status==="fulfilled"?tasks[2].value.docs.map(d=>d.data()).sort((a,b)=>String(b.actualizadoEn||b.fechaEnvio||"").localeCompare(String(a.actualizadoEn||a.fechaEnvio||""))).map(pick):[];
 if(!student&&envios.length===0){
  if(issues.length)throw new HttpsError("unavailable","No se pudo completar la consulta",{referencia:trace,fases:issues});
  throw new HttpsError("not-found","Sin información disponible");
 }
 return {nombres:student?.nombres||"",cedula,nombreCarreraActual:student?.nombreCarreraActual||"",periodoId:selected?.periodoId||envios[0]?.periodoCanonicoId||null,envios,consultaParcial:issues.length>0,diagnostico:issues,referencia:issues.length?trace:null};
});
