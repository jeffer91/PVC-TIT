# PVC-TIT · ITSQMET

Consulta académica de estudiantes (solo lectura). Interfaz estática para GitHub Pages y API segura mediante Firebase Functions.

## Despliegue
1. En GitHub → Settings → Pages, selecciona **GitHub Actions**. El workflow de este repositorio publicará la interfaz.
2. En Firebase → Authentication → Sign-in method, activa **Email link (passwordless sign-in)** y Email/Password si lo solicita.
3. En Authentication → Settings → Authorized domains, añade `jeffer91.github.io`.
4. En un equipo con Firebase CLI: `npm install -g firebase-tools`, `firebase login`, `cd functions && npm install && cd ..`, `firebase deploy --only functions --project utet-4387a`. Firebase Cloud Functions normalmente requiere Blaze.
5. El correo utilizado debe coincidir con `correoInstitucional` o `correoPersonal` de `Estudiante/{cedula}`.
6. Revisa que no existan reglas abiertas de Firestore. La función utiliza Admin SDK y no requiere exponer colecciones al cliente. No despliegues reglas desde aquí sin revisar primero las existentes.

## Consultas
- `Estudiante/{cedula}`: `nombres`, `cedula`, `nombreCarreraActual`, y correos únicamente para autorización.
- `matriculas`: busca por prefijo de `localId = cedula + "__"`, excluye retirados, prioriza coincidencia exacta de nombre de carrera y el `periodoId` más reciente.
- Si hay más de 100 matrículas para una cédula, revisar la estrategia del límite. Si ninguna coincide con la carrera, usa la más reciente.
- La plataforma **no modifica datos**.

## Seguridad y pendientes
No basta conocer una cédula: el usuario debe controlar un correo registrado. Nunca abrir permisos generales de lectura de Firestore. Para producción conviene configurar App Check, control de tasa por usuario/IP y monitoreo de abuso en la función. El dominio y envío de enlaces dependen de configurar Firebase Authentication. GitHub Pages no ejecuta Functions: despliega el backend por separado.
