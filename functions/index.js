const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {createHash}=require("crypto");
const db=getFirestore(initializeApp({projectId:"utet-4387a"}));
const titulos=getFirestore(initializeApp({projectId:"titulos-ec2fa"},"titulos"));
async function limit(ip){
 if(!ip)throw new HttpsError("unavailable","Sin origen");
 const minute=Math.floor(Date.now()/60000);
 const key=createHash("sha256").update(ip+minute).digest("hex");
 const ref=db.collection("_pvcTitRateLimits").doc(key);
 await db.runTransaction(async t=>{const s=await t.get(ref);const n=s.data()?.count||0;if(n>=5)throw new HttpsError("resource-exhausted","Límite de consultas");t.set(ref,{count:n+1,expireAt:new Date(Date.now()+120000)});});
}
const fields=["estado","periodoId","periodoNombre","tituloFinal","tituloFinalInvestigacion","titulo1","titulo2","titulo3","comentarioCoordinador","observacionInvestigacion","ultimoComentario","observacion","observacionDevolucion","ultimaFechaRevision","fechaEnvio"];
exports.consultarFicha=onCall({region:"us-central1",cors:["https://jeffer91.github.io"],maxInstances:10},async req=>{
 const cedula=String(req.data?.cedula||"").trim();
 if(!/^\d{10}$/.test(cedula))throw new HttpsError("invalid-argument","Cédula inválida");
 await limit(req.rawRequest.ip);
 const doc=await db.collection("Estudiante").doc(cedula).get();
 if(!doc.exists||doc.data().eliminado===true)throw new HttpsError("not-found","Sin registro");
 const s=doc.data(),prefix=cedula+"__";
 const [m,e]=await Promise.all([
  db.collection("matriculas").orderBy("localId").startAt(prefix).endAt(prefix+"\uf8ff").limit(100).get(),
  titulos.collection("envios").where("cedula","==",cedula).limit(30).get()
 ]);
 const matriculas=m.docs.map(x=>x.data()).filter(x=>x.retirado!==true).sort((a,b)=>String(b.periodoId||"").localeCompare(String(a.periodoId||"")));
 const envios=e.docs.map(x=>x.data()).sort((a,b)=>String(b.actualizadoEn||b.fechaEnvio||"").localeCompare(String(a.actualizadoEn||a.fechaEnvio||""))).map(x=>Object.fromEntries(fields.map(k=>[k,typeof x[k]==="string"?x[k]:""])));
 return {nombres:s.nombres||"",cedula,nombreCarreraActual:s.nombreCarreraActual||"",periodoId:matriculas[0]?.periodoId||null,envios};
});
