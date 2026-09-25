# JELENIUS FIRST ORG ADMIN RECOVERY REPORT

**Estado: reparación preparada y validada localmente; pendiente de ejecución en
Coolify.** No se ha leído ni modificado la base de producción. Por indicación del
usuario se entrega mediante commit/push, sin acceso remoto a producción.

| Campo | Resultado |
| --- | --- |
| Organization | Producción: id=1 según el incidente; slug pendiente de auditoría |
| Admin count before | Producción: 0 según el error de la guardia reportado; pendiente de SELECT independiente. Fixture local: 0 |
| Initial admin user | Resolver `LEARNHOUSE_INITIAL_ADMIN_EMAIL`; identidad de producción pendiente |
| Membership existed | Pendiente en producción; el script exige exactamente uno. Fixture local: YES |
| Admin role | `role_global_admin`, nombre `Admin`, tipo `TYPE_GLOBAL`, `org_id IS NULL`; ID debe coincidir con `ADMIN_ROLE_ID` verificado en código |
| Repair mechanism | One-shot ORM transaccional, ejecutado manualmente por operador |
| Database direct write required | YES: actualización de un único `userorganization.role_id` y su `update_date` |
| Admin count after | Producción: pendiente. PostgreSQL local: 1 |
| User → Instructor | PASS local, HTTP 200; pendiente en producción |
| Instructor → Maintainer | PASS local, HTTP 200; pendiente en producción |
| Maintainer → Admin | PASS local, HTTP 200; pendiente en producción |
| Last-admin protection | PASS local, HTTP 400; pendiente en producción |
| Root cause | Causa inmediata: ausencia de membership reconocido como Admin. Causa histórica de producción no demostrada; ventanas de bootstrap parcial reproducidas localmente |
| Can recur on fresh deploy | YES si falla/interrumpe el bootstrap entre sus commits; la instalación completa correctamente finalizada sí crea ambos registros |
| Permanent bootstrap fix recommended | YES, propuesta acotada abajo; no implementada en este cambio |
| Tests | 45 PASS; PostgreSQL aislado: commit, relectura, bloqueo de escritura y doble ejecución concurrente PASS |
| New SHA | Commit que introduce este informe (`git log -1 --format=%H -- jelenius-docs/first-org-admin-recovery.md`) |

## Modelos y mecanismo existente

- `src/db/users.py`: `User`, tabla `"user"`. `is_superadmin` es una capacidad
  de instancia; no sustituye un rol de organización.
- `src/db/organizations.py`: `Organization`, tabla `organization`; seleccionar
  por `id` y comprobar `slug`/`org_uuid`.
- `src/db/user_organizations.py`: `UserOrganization`, tabla `userorganization`;
  contiene `id`, `user_id`, `org_id`, `role_id` y timestamps. Sus índices no
  garantizan unicidad de `(user_id, org_id)`, por lo que se rechazan duplicados.
- `src/db/roles.py`: `Role`, tabla `role`. El membership guarda la FK numérica
  `role_id`; `role_uuid` se resuelve en esa tabla, no en `User`.
- `src/security/rbac/constants.py`: `ADMIN_ROLE_ID = 1`. El script resuelve el
  rol por UUID/nombre/tipo y valida su ID contra esta constante, sin asumir
  que un restore conserva correctamente los IDs.
- `src/services/setup/setup.py::install_default_elements` crea/refresca el
  rol Admin con id 1. **No debe ejecutarse para reparar este incidente**:
  también escribe definiciones de permisos.
- `install_create_organization_user` crea usuario y membership Admin, pero
  rechaza usuarios existentes. No es una rutina adecuada para este recovery.
- `src/services/orgs/users.py::update_user_role` conserva ambas guardias:
  `There is no admin in the organization` y
  `Organization must have at least one admin`. No se modifican.

## Comandos de producción (terminal del contenedor de la aplicación Coolify)

Usar la versión que contiene `scripts/recover_first_org_admin.py`. En la imagen
del Dockerfile raíz, el backend está en `/app/api` y su Python en
`/app/api/.venv/bin/python`. No usar `cli.py install` en esta base existente.

Primero, **solo lectura**:

```sh
cd /app/api
.venv/bin/python -m scripts.recover_first_org_admin --org-id 1 --mode audit
```

La salida muestra organización, miembros (membership ID, org ID, user ID,
email, rol ID/UUID/nombre/tipo, is_superadmin), candidatos al rol y al usuario
inicial, `admin_count` semántico y `backend_guard_admin_memberships`.
No selecciona columnas de contraseña/hash. El email se toma del entorno
`LEARNHOUSE_INITIAL_ADMIN_EMAIL`; no se requiere la contraseña inicial.
El id 1 proviene del incidente y se audita antes de cualquier escritura.

Comprobar que ambos contadores son 0; que el email corresponde al fundador
esperado y que ya tiene membership en esa organización. Copiar el slug real:

```sh
export RECOVERY_ORG_SLUG='SLUG_VERIFICADO_EN_LA_AUDITORIA'
.venv/bin/python -m scripts.recover_first_org_admin \
  --org-id 1 --org-slug "$RECOVERY_ORG_SLUG" --mode dry-run
```

Si la variable del email inicial ya no está configurada, añadir
`--email 'EMAIL_VERIFICADO_DEL_USUARIO_EXISTENTE'` a dry-run/apply/verify.
No elegir otra cuenta ni crear memberships para sortear una negativa.

Tras revisar el resultado `ready`, en una breve ventana de mantenimiento y
con backup de la base disponible:

```sh
.venv/bin/python -m scripts.recover_first_org_admin \
  --org-id 1 --org-slug "$RECOVERY_ORG_SLUG" --mode apply
.venv/bin/python -m scripts.recover_first_org_admin \
  --org-id 1 --org-slug "$RECOVERY_ORG_SLUG" --mode verify
```

`apply` toma bloqueos PostgreSQL de tabla `SHARE ROW EXCLUSIVE` sobre
organization/user/role/userorganization: las lecturas siguen disponibles;
las escrituras concurrentes esperan brevemente. El timeout de adquisición es
5 segundos y el de cada sentencia 30 segundos. Estos bloqueos son necesarios
porque las rutas existentes no toman un lock sobre la fila de organización.
La escritura afecta exactamente un membership, confirma el invariante antes
de commit y vuelve a consultar después del commit. No hay llamadas a correo,
webhooks ni modificaciones de usuarios, roles, permisos o Enterprise.

Tras el commit intenta invalidar únicamente `session:<user_id>` en Redis,
igual que la ruta normal de roles. Si Redis no está disponible, la salida lo
indica: esperar el TTL de 600 segundos antes de verificar el estado de sesión
en UI. No se vacía Redis ni se eliminan tokens de autenticación.

Una segunda ejecución `apply` aborta sin escribir si ya hay Admin; usar
`verify` para una comprobación exitosa sin cambios. Códigos de salida: 0 para
éxito, 2 para negativa por precondiciones, 1 para error operativo. Si ocurre
un error, ejecutar auditoría antes de reintentar: un fallo de conexión durante
commit no permite deducir su resultado únicamente desde el cliente.

## SQL alternativo de auditoría (psql, solo lectura)

El script anterior es suficiente. Para una comprobación independiente en psql:

```sql
\set org_id 1
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT id, slug, name, org_uuid FROM organization WHERE id = :org_id;
SELECT m.id AS membership_id, m.org_id, m.user_id, u.email, u.is_superadmin,
       m.role_id, r.role_uuid, r.name AS role_name, r.role_type, r.org_id AS role_org_id
FROM userorganization m
LEFT JOIN "user" u ON u.id = m.user_id
LEFT JOIN role r ON r.id = m.role_id
WHERE m.org_id = :org_id ORDER BY m.id;
SELECT id, role_uuid, name, role_type, org_id FROM role
WHERE role_uuid = 'role_global_admin'
   OR (name = 'Admin' AND role_type = 'TYPE_GLOBAL') OR id = 1;
SELECT count(DISTINCT u.id) AS valid_admin_count
FROM userorganization m
JOIN "user" u ON u.id = m.user_id
JOIN role r ON r.id = m.role_id
WHERE m.org_id = :org_id AND r.role_uuid = 'role_global_admin'
  AND r.name = 'Admin' AND r.role_type = 'TYPE_GLOBAL' AND r.org_id IS NULL;
-- ID 1 is the audited backend ADMIN_ROLE_ID, not a proposed UPDATE target.
SELECT count(*) AS backend_guard_admin_memberships
FROM userorganization WHERE org_id = :org_id AND role_id = 1;
ROLLBACK;
```

## Comprobación API/UI posterior

1. Volver a entrar como el fundador recuperado y verificar su rol de organización.
2. Mientras sea el único Admin, intentar degradar su propio rol: debe responder
   HTTP 400, `Organization must have at least one admin`. Confirmar después
   `admin_count >= 1`. No borrar ni degradar otros admins para fabricar el caso.
3. Elegir un segundo miembro existente autorizado para esta prueba, comprobando
   su identidad y rol actual; no asumir que id=3 es la cuenta adecuada.
4. En gestión de usuarios realizar User → Instructor → Maintainer → Admin.
   Registrar HTTP 200 para cada `PUT /api/v1/orgs/{org_id}/users/{user_id}/role/{role_uuid}`
   y comprobar que la UI refleja el cambio. UUIDs: `role_global_instructor`,
   `role_global_maintainer`, `role_global_admin`.
5. Acordar el rol final de ese segundo miembro; la prueba completa lo deja Admin.
   Conservar resultados sin copiar cookies/tokens en Git ni en el informe.

Las pruebas locales usan el router y servicio reales, con autenticación de
fixture y DB SQLite; no sustituyen RBAC, seat checks ni last-admin checks.
Solo se suprime la entrega externa de webhooks. PostgreSQL aislado valida
además que dos reparaciones concurrentes producen exactamente un commit y
una negativa, y que se bloquean escrituras concurrentes de memberships.

## Causa histórica y propuesta permanente

El flujo completo de instalación sí crea un usuario superadmin y su membership
Admin. Se verificó con una prueba positiva. El código actual también permite:

1. `_install_async(short=True)` guarda la organización y su configuración **antes**
   de validar `LEARNHOUSE_INITIAL_ADMIN_PASSWORD`. Si falta, queda una organización
   sin usuario inicial. Cambiar la variable después no reanuda el bootstrap.
2. `install_create_organization_user` hace commit del usuario superadmin **antes**
   del commit del membership. Si falla ese INSERT o el proceso se interrumpe,
   queda un superadmin sin membership. Se reprodujo con fallo inyectado.
3. `auto_install` solo comprueba si existe alguna organización. Si existe, refresca
   roles y omite la instalación, incluso con cero admins. Reproducido en prueba.

Estos hallazgos demuestran que el defecto puede repetirse en un fresh deploy;
no permiten elegir entre interrupción, configuración inicial incompleta,
seed/manual setup, restore/import u otro cambio histórico en esta producción.
Para atribuirlo hacen falta la auditoría y logs del primer deploy/restore.
Si el fundador **no tiene membership**, este script abortará por diseño;
crear esa asociación requiere una decisión separada con la identidad verificada.

Fix mínimo recomendado en otro cambio: validar credenciales y `UserCreate`
antes de persistir la organización y hacer atómica la transacción que crea
organización/configuración/usuario/membership, con una sola frontera de commit.
Preservar el comportamiento de los helpers para otros callers y comprobar el
invariante antes de confirmar. Nunca promover automáticamente usuarios de una
organización existente en cada arranque. No se implementa esa refactorización
en este one-shot de recuperación.

## Archivos y validación

- `apps/api/scripts/recover_first_org_admin.py`: auditoría, dry-run, apply y verify.
- `apps/api/src/tests/services/test_first_org_admin_recovery.py`: rechazos,
  rollback, repetición y promociones API con guardias reales.
- `apps/api/src/tests/services/test_bootstrap_admin_atomicity.py`: éxito normal
  y reproducción de fallos parciales del bootstrap actual.
- Este informe/runbook. No se modifica código de API, bootstrap o Enterprise.

```sh
cd apps/api
.venv/bin/python -m pytest \
  src/tests/services/test_first_org_admin_recovery.py \
  src/tests/services/test_bootstrap_admin_atomicity.py \
  src/tests/services/test_setup_service.py \
  src/tests/services/test_org_users_service.py -q
# 45 passed
```

No se despliega ni se mueve el tag demo como parte de esta recuperación.
