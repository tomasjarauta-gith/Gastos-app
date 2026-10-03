# Gastos personales y compartidos

App web con acceso mediante Google y persistencia en Firebase Realtime Database.

## Uso

1. Abrir https://gastos-app-green-beta.vercel.app e ingresar con Google.
2. **Solo yo · Mis gastos** contiene los gastos privados de esa cuenta.
3. En **Compartir**, crear un espacio de pareja y generar un código. La segunda persona entra con su propia cuenta de Google y pega ese código en **Unirme al espacio**.
4. El selector permite alternar entre gastos personales y compartidos. No se copian datos automáticamente entre espacios.

El código vence a los siete días, se puede anular y permite unir una sola segunda cuenta. Los participantes pueden agregar, editar y borrar gastos compartidos y saldar deudas. El espacio personal de cada uno permanece privado.

## Datos y seguridad

- Proyecto existente: `gastos-compartidos-c5937`.
- Personales: `/users/{uid}/data`.
- Compartidos: `/spaces/{ownerUid}/data`, con un único participante adicional en `partner`.
- Invitaciones: `/invitations/{codigoAleatorio}`. No se pueden enumerar desde el cliente.
- Las reglas de `database.rules.json` requieren autenticación con Google, verifican propietario o participante y validan los datos.
- Los datos antiguos de la raíz no se migran ni se borran. La nueva app empieza vacía y no accede a ellos.
- La app informa guardados pendientes y rechaza nuevos cambios sin conexión; no ofrece guardado local sin cuenta.

## Configuración

Google debe estar habilitado en Authentication y el dominio de la app debe figurar en Dominios autorizados. Las reglas de `database.rules.json` se publican en Realtime Database. `firebase.json` y `.firebaserc` permiten desplegarlas también con Firebase CLI.

`index.html` es la versión actual de la app. El ZIP original del repositorio es una copia anterior.

Para desarrollar localmente se necesita servir la app por HTTP en localhost; abrir el HTML como `file://` no permite iniciar sesión con Google.

## Pruebas

- `node test-app.cjs`: verifica inicio y cierre de sesión, separación de datos, cambio de espacio, errores sin conexión y escrituras pendientes con dobles de prueba.
- `node test-rules.cjs`: requiere el emulador oficial de Realtime Database en `127.0.0.1:9000`. Usa únicamente el namespace local `demo-gastos-auth`; comprueba aislamiento, invitaciones y cambios compartidos. No usa credenciales ni datos de producción.
