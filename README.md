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
