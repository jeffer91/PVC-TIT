const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {createHash}=require("node:crypto");
initializeApp();
const db=getFirestore();
const limitRef=(ip,bucket)=>db.collection("_pvcTitRateLimits").doc(createHash("sha256").update("pvc-tit:"+ip+":"+bucket).digest("hex"));
async function throttle(ip){
 if(!ip)throw new HttpsError("unavailable","No se pudo comprobar el origen.");
 const now=Date.now(),minute=Math.floor(now/60000),day=Math.floor(now/86400000);
 // Transaction avoids race conditions across Cloud Function instances.
 await db.runTransaction(async tx=>{
  const refs=[limitRef(ip,"m"+minute),limitRef(ip,"d"+day)];
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  if((snaps[0].data()?.count||0)>=5||(snaps[1].data()?.count||0)>=30)throw new HttpsError("resource-exhausted","Demasiadas consultas.");
  refs.forEach((ref,i)=>tx.set(ref,{count:(snaps[i].data()?.count||0)+1,expireAt:new Date(now+(i===0?2*60000:2*86400000))}));
 });
}
exports.consultarFicha=onCall({region:"us-central1",maxInstances:10,timeoutSeconds:15,cors:["https://jeffer91.github.io"]},async request=>{
 const cedula=String(request.data?.cedula||"").trim();
 if(!/^\d{10}$/.test(cedula))throw new HttpsError("invalid-argument","La cédula debe tener 10 dígitos.");
 await throttle(request.rawRequest.ip);
 const snap=await db.collection("Estudiante").doc(cedula).get();
 if(!snap.exists || snap.data()?.eliminado===true)throw new HttpsError("not-found","No hay información disponible.");
 const student=snap.data();
 const start=cedula+"__";
 const docs=await db.collection("matriculas").orderBy("localId").startAt(start).endAt(start+"\uf8ff").limit(100).get();
 const records=docs.docs.map(d=>d.data()).filter(r=>String(r.localId||"").startsWith(start)&&r.retirado!==true);
 records.sort((a,b)=>String(b.periodoId||"").localeCompare(String(a.periodoId||"")));
 const matching=records.filter(r=>String(r.nombreCarrera||"").trim().toUpperCase()===String(student.nombreCarreraActual||"").trim().toUpperCase());
 const selected=(matching.length?matching:records)[0];
 return {nombres:String(student.nombres||""),cedula,nombreCarreraActual:String(student.nombreCarreraActual||""),periodoId:selected?.periodoId||null};
});
