# dokploy-cli

CLI para gestionar despliegues completos en [Dokploy](https://dokploy.com) desde la
terminal: proyectos, aplicaciones, composes, servidores, dominios, variables de
entorno, despliegues y ejecución de comandos en contenedores.

> [!IMPORTANT]
> **Cliente no oficial.** Este proyecto no está afiliado, asociado, autorizado ni
> respaldado por Dokploy ni por sus mantenedores. "Dokploy" es marca de sus
> respectivos propietarios y aquí se usa solo con fines descriptivos para indicar
> compatibilidad. Úsalo bajo tu propia responsabilidad.

## Requisitos

- Node.js >= 20
- Una instancia de Dokploy accesible y una API key (Settings → API/Tokens).

## Instalación

Desde el código fuente (aún no publicado en npm):

```bash
git clone https://github.com/JesusArcasCarrera/dokploy-cli.git
cd dokploy-cli
npm install
npm run build
npm link        # expone el binario `dokploy` en tu PATH
```

## Configuración

```bash
dokploy auth login        # te pide URL de la instancia y API key
```

Las credenciales se guardan con [`conf`](https://github.com/sindresorhus/conf) en el
directorio de configuración del usuario (`~/.config/dokploy-cli` en Linux), **fuera
del repositorio**. La API key viaja únicamente en la cabecera `x-api-key` y nunca se
escribe en los logs.

## Uso

```bash
dokploy projects list
dokploy apps list --project <id>
dokploy apps deploy <appId>
dokploy compose list
dokploy servers list
dokploy domains list <appId>
dokploy env list <appId>            # variables sensibles enmascaradas por defecto
dokploy env list <appId> --reveal   # mostrar valores en claro (opt-in explícito)
dokploy deployments list --app <appId>
dokploy exec <container> <cmd>       # comando puntual
dokploy exec <container> --it        # sesión interactiva
```

Usa `dokploy <comando> --help` para ver todas las opciones. Muchos listados aceptan
`--json` para integrarlos en scripts.

## Seguridad

- La API key da control total sobre tus despliegues: trátala como un secreto.
- Los valores de variables de entorno marcados como `PASSWORD`, `SECRET`, `TOKEN`,
  `KEY`, etc. se enmascaran por defecto; solo se revelan con `--reveal`.

## Licencia

[MIT](./LICENSE) © 2026 Jesús Arcas Carrera
