# Parches sobre Dokploy (upstream)

Este archivo documenta **todos los cambios** que se aplican al repo local de Dokploy
(`/home/jesus/Code/devs/dokploy`) para que el CLI funcione correctamente.

Cada vez que se haga `git pull` del upstream oficial, estos parches pueden romperse.
Re-aplícalos en orden después de actualizar.

---

## Estado actual

**No hay parches aplicados.** El CLI consume la API existente de Dokploy tal cual.

La API tRPC-OpenAPI de Dokploy ya expone endpoints suficientes para:
- Proyectos (CRUD)
- Aplicaciones (CRUD + deploy/redeploy)
- Compose (CRUD + deploy/redeploy)
- Despliegues (historial + cola)
- Servidores (listar + detalle)
- Dominios (listar + crear)
- Docker (contenedores)
- Settings

### Autenticación
- Header: `x-api-key`
- Se genera desde el dashboard: Settings > API Keys

---

## Formato de parches

Cuando se necesite un parche, documentarlo así:

```
### PATCH-001: <título descriptivo>
- **Archivo:** `ruta/relativa/desde/raiz/dokploy`
- **Rama local:** `cli-patches` (o la que corresponda)
- **Motivo:** Por qué es necesario
- **Cambio:** Qué se modifica exactamente
- **Re-aplicar:** Comando o pasos para re-aplicar tras `git pull`
- **Riesgo de conflicto:** Alto/Medio/Bajo
```
