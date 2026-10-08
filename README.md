# PVC-TIT · Consulta ITSQMET

El estudiante ingresa únicamente su cédula (10 dígitos). La aplicación muestra nombres, cédula, carrera actual y último período disponible, sin solicitar cuenta, correo ni contraseña.

## Arquitectura
- Frontend: GitHub Pages, `index.html`.
- Backend: callable Firebase Function `consultarFicha` (requiere despliegue independiente).
- Firestore: solo lectura de `Estudiante/{cedula}` y `matriculas` mediante Admin SDK. La función escribe exclusivamente contadores en `_pvcTitRateLimits`, NO edita datos académicos.
- Matrículas: búsqueda por prefijo de `localId`, excluye `retirado: true`, prioriza coincidencia de carrera y después el `periodoId` más reciente.

## Desplegar
1. En GitHub → Settings → Pages: Source **GitHub Actions**, si aún no se encuentra publicado.
2. Instalar Firebase CLI: `npm install -g firebase-tools` y `firebase login`.
3. En el repositorio: `cd functions && npm install && cd ..`.
4. Ejecutar `firebase deploy --only functions --project utet-4387a`.
5. Comprobar conexión desde `https://jeffer91.github.io/PVC-TIT/`. La función requiere Cloud Functions habilitado, normalmente plan Blaze. No se despliega automáticamente con GitHub Pages.

## Seguridad y privacidad
- Conocer una cédula NO verifica identidad: **cualquier persona que la conozca puede obtener los cuatro campos expuestos**. Confirmar autorización institucional y base legal antes de uso público.
- La función restringe CORS a GitHub Pages y limita por IP a 5 consultas/minuto y 30/día (registros de control). CORS NO sustituye autenticación; clientes no navegadores pueden invocarla.
- Se devuelven exclusivamente los cuatro campos públicos seleccionados; nunca correos, teléfonos, hashes ni otros datos internos.
- **No abrir reglas de lectura general para Firestore.** El frontend no usa el SDK de Firestore. Revisar reglas existentes independientemente.
- Recomendado antes de producción: Firebase App Check (configurar la web y habilitar `enforceAppCheck` en la función), controles contra IP compartidas / abuso distribuido, alertas y monitoreo, política de retención de contadores (configurar TTL en `expireAt` de `_pvcTitRateLimits`).
- No desplegar aún como servicio público si la organización no autorizó una consulta de información personal sin verificación de identidad.

## Segunda consulta de títulos
La función también lee `titulos-ec2fa/envios` mediante una segunda instancia Admin SDK. **Es obligatorio conceder permisos IAM de lectura Firestore al service account de la función de `utet-4387a` en el proyecto `titulos-ec2fa`** (por ejemplo, `roles/datastore.viewer`). Configurar el proyecto secundario no concede acceso automáticamente. Mantener reglas Firestore cerradas.

La interfaz presenta aprobado final solo para `estado=APROBADO_FINAL`, títulos enviados y comentarios. Debes desplegar la función actualizada con `firebase deploy --only functions --project utet-4387a` y confirmar la publicación GitHub Pages. Sin este despliegue la segunda consulta no funcionará.

**Privacidad:** conocer la cédula permite ver información académica sin autenticar identidad. Requiere autorización institucional expresa antes de exposición pública; límites por IP y CORS no ofrecen verificación de titularidad.

## Resolver error CORS / preflight de consultarFicha
El front-end de GitHub Pages **no** despliega Cloud Functions. Existe un workflow manual en **Actions → Desplegar backend PVC-TIT → Run workflow**.

Antes de ejecutarlo, un administrador de Google Cloud debe:
1. Crear o seleccionar una cuenta de servicio de despliegue para `utet-4387a`, otorgándole los roles mínimos necesarios para desplegar Functions Gen2 (Cloud Functions Developer, permiso Service Account User sobre la identidad de ejecución y permisos de compilación/artifacts necesarios). No incluir JSON de credenciales en el repositorio.
2. Registrar su JSON como secreto de GitHub Actions: `FIREBASE_SERVICE_ACCOUNT_UTET`. Es preferible migrar a Workload Identity Federation para evitar claves persistentes.
3. Verificar que Cloud Functions/Cloud Run estén habilitados y facturación compatible.
4. Conceder al **service account de ejecución de consultarFicha** permisos de **lectura** Firestore en `titulos-ec2fa` (por ejemplo `roles/datastore.viewer`). Es una identidad distinta de la cuenta de despliegue.
5. Revisar la política institucional de privacidad: al consultar solo por cédula, el acceso es público a cualquiera que conozca ese número. Si se autoriza expresamente ese diseño, configurar el invocador de la función Gen2 para permitir invocaciones sin autenticación; de lo contrario, mantenerlo restringido. Un preflight 403/401 sin cabeceras CORS puede deberse a Cloud Run Invoker. No abrir reglas de Firestore.
6. Ejecutar el workflow manual y consultar sus registros. Solo cuando el deploy e IAM finalicen, probar la aplicación.

Si un bloqueo CORS persiste, abrir las herramientas de red y verificar el código HTTP de OPTIONS. El navegador **no puede leer un error interno si CORS bloquea la respuesta**. El mensaje de la web incluye diagnóstico de transporte, no presume el error exacto de Google Cloud.
