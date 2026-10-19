# Sipinnito · bot de WhatsApp para reportar trabajo infantil

Sipinnito es el asistente de **SIPINNA Atizapán de Zaragoza** que recibe reportes de trabajo infantil por WhatsApp. Conversa con la persona, reúne los datos del reporte (qué vio, cuántos niños, edad, actividad, hora, ubicación y fotos), le muestra un resumen para confirmar y lo registra en el sistema de reportes de SIPINNA.

Corre con un **modelo de lenguaje local** ([Ollama](https://ollama.com)): las conversaciones se procesan en la misma computadora, sin servicios externos de IA. Lo único que sale es el reporte confirmado, que se envía a la API de SIPINNA.

## Cómo funciona

```
WhatsApp ──► whatsapp/          conexión (Baileys), números permitidos, cola por persona, "escribiendo…"
                │
                ▼
            report/conversation.js     procesa un mensaje de principio a fin
                │
                ├─ extractor.js   el modelo lee el mensaje y saca los datos         (cantidad, edad, actividad, hora…)
                ├─ draft.js       el borrador del reporte                           (en Redis, caduca en 2 h)
                ├─ rules.js       el código decide qué sigue                        (qué preguntar, resumen, 911…)
                ├─ writer.js      el mensaje para la persona                        (el modelo redacta; lo exacto son plantillas)
                └─ send.js        al confirmar, envía el reporte a la API de SIPINNA
```

La idea central: **el modelo solo hace lo que únicamente un modelo puede hacer** (entender lo que escribe la persona y redactar respuestas naturales) y **el código hace todo lo que tiene que ser exacto**: llevar la cuenta de los datos, decidir qué preguntar, el aviso del 911, el resumen y el envío. Por eso funciona bien con un modelo pequeño en una sola computadora.

Algunos ejemplos de esa división:

- El modelo copia "como de 12" y el código lo convierte al rango "11 a 13 años".
- El modelo copia "de la tarde" y el código arma la hora `17:00`; si la persona solo dijo "a las 5", el código pregunta "¿de la mañana o de la tarde?" en lugar de adivinar.
- Lo que el modelo dice haber leído se verifica contra el mensaje: si no aparece, se descarta.
- El resumen, el aviso del 911 y la pregunta de fotos son plantillas fijas: siempre dicen exactamente lo mismo.

## Una conversación

1. La persona cuenta lo que vio, con sus palabras. Si su relato ya trae varios datos, el bot no los vuelve a preguntar.
2. El bot pregunta, uno por uno, los datos que falten. Si la persona no sabe, le ofrece opciones aproximadas ("¿2, 5, 10 o 20?"); si aun así no sabe, usa un valor por defecto y lo avisa en el resumen.
3. Pide que comparta la **ubicación** desde WhatsApp (obligatoria: nunca se inventa).
4. Ofrece recibir hasta **2 fotos** (opcionales), recordando que no se vea la cara de nadie.
5. Si el relato es muy corto, invita a contar un poco más.
6. Muestra el **resumen**. La persona confirma, corrige un dato ("no, eran cinco") o agrega algo.
7. Al confirmar, el reporte se registra en el sistema de SIPINNA y se borra del bot.

En cualquier momento:

- Si describe a un menor en **peligro inmediato**, el bot indica llamar al **911** (una vez) y sigue con el reporte.
- Si pregunta algo **fuera de tema** ("¿cómo saco mi acta?"), la canaliza con el enlace o número adecuado (municipio, DIF, 089, 088…).
- Un saludo o un "gracias" recibe una respuesta amable.
- Audios, videos y documentos no se procesan: el bot pide que lo escriba.

## Software necesario

| | |
| --- | --- |
| Node.js | 20.12 o superior (probado con Node 24) |
| [Ollama](https://ollama.com) | con el modelo `qwen3.5:4b` (unos 3.3 GB) |
| Docker | para Redis |
| WhatsApp | un número **dedicado** al bot, vinculado como dispositivo |
| API de SIPINNA | acceso a `https://api.sipinna.com` |

## Requisitos de la computadora

Lo que más recursos usa es el **modelo de lenguaje**; el bot, Redis y lo demás consumen muy poco. Los números de esta sección se midieron durante el desarrollo, salvo los marcados como estimados.

Se recomienda una **computadora dedicada solo al bot, con Linux**: así su consumo es predecible y nadie la apaga o la satura por usarla para otras cosas.

### Qué consume cada parte

| Parte | Memoria | Disco |
| --- | --- | --- |
| Sistema operativo | Linux: ~1 GB · Windows: 3 a 4 GB | — |
| Modelo `qwen3.5:4b`, cargado | ~3.3 GB (en la RAM o en la memoria de la GPU) | 3.3 GB |
| Bot (Node.js + Baileys) | ~110 MB | ~65 MB de dependencias |
| Redis (Docker) | 50 a 100 MB | ~60 MB de imagen + unos pocos MB de datos |
| Fotos en espera | — | ~1 MB por reporte; se borran al enviarse |
| **Total** | **~5 a 6 GB en Linux** | **~5 GB** (más margen para el sistema y actualizaciones) |

### Configuraciones

| | Mínima | Recomendada |
| --- | --- | --- |
| Procesador | 4 núcleos x86-64 con **AVX2** (casi cualquier Intel o AMD de 2015 en adelante) | 6 a 8 núcleos |
| Memoria RAM | 8 GB | 16 GB |
| Tarjeta gráfica | No necesaria (usar `LLM_MODEL=qwen2.5:3b`) | NVIDIA con **6 GB o más de VRAM** (por ejemplo, RTX 3060), o una Mac con Apple Silicon y 16 GB |
| Disco | SSD con 20 GB libres | SSD con 50 GB libres o más |
| Sistema operativo | Linux con Docker (por ejemplo, Ubuntu Server LTS) | Igual |
| Internet | Conexión estable | Conexión por cable |

Sin AVX2 el modelo funciona, pero mucho más lento. En una Mac, la memoria de la tarjeta gráfica es la misma RAM y macOS solo deja usar cerca de dos tercios para ella, por eso ahí se recomiendan 16 GB.

### Velocidad esperada

Cada respuesta del bot hace dos llamadas al modelo: una para entender el mensaje y otra para redactar la respuesta.

| Equipo | Modelo | Tiempo por respuesta |
| --- | --- | --- |
| Mac con Apple Silicon (M5, 16 GB) | `qwen3.5:4b` | 4 a 9 s (medido) |
| PC con GPU NVIDIA de 6 GB o más | `qwen3.5:4b` | 3 a 6 s (estimado) |
| PC sin GPU | `qwen2.5:3b` | 5 a 15 s (estimado) |
| PC sin GPU | `qwen3.5:4b` | 40 a 60 s (estimado): **no recomendado** |

La primera respuesta después de arrancar tarda más, porque el modelo se carga en memoria.

### Cuántas personas a la vez

Ollama procesa una petición a la vez. Con GPU, eso son unos **10 mensajes por minuto en total**: si cinco personas escriben al mismo tiempo, la última espera unos 25 segundos. Los mensajes de una misma persona se responden en orden, y los de personas distintas se van turnando. Para más volumen hace falta una GPU más potente.

### Red

- El bot **solo hace conexiones de salida** (HTTPS): a los servidores de WhatsApp y a `api.sipinna.com`. **No necesita IP pública, puertos abiertos ni dominio.**
- Redis y Ollama solo escuchan en la misma computadora.
- Si se cae el internet, el bot se reconecta solo cuando vuelve.

### Funcionamiento continuo

- La computadora debe estar **encendida todo el tiempo**, con la suspensión y la hibernación desactivadas.
- Se recomienda un **no-break (UPS)** y activar en el BIOS el encendido automático al volver la luz.
- El **teléfono del número del bot** debe mantenerse cargado y con internet: WhatsApp desvincula los dispositivos vinculados si el teléfono principal pasa **14 días sin conectarse**, y habría que escanear el QR otra vez.

## Instalación

```bash
git clone https://github.com/JBanuel/baileysService.git
cd baileysService
npm install
```

Descargar el modelo:

```bash
ollama pull qwen3.5:4b
```

Levantar Redis en Docker. Solo acepta conexiones desde la misma computadora y guarda los datos en disco para que sobrevivan reinicios:

```bash
docker run -d --name sipinna-redis -p 127.0.0.1:6379:6379 --restart unless-stopped -v sipinna-redis-data:/data redis:7-alpine redis-server --appendonly yes
```

Crear el archivo `.env` (ver la sección siguiente) y arrancar:

```bash
npm start
```

La primera vez aparece un **código QR** en la terminal: escanéalo desde WhatsApp → *Dispositivos vinculados* en el teléfono del número del bot. La sesión queda guardada en `auth_info_baileys/` y no hay que volver a escanear.

## Configuración (`.env`)

```bash
# Números a los que el bot responde, con lada y sin "+", separados por coma
ALLOWED_NUMBERS=525512345678,525598765432

# Modelo de Ollama
LLM_MODEL=qwen3.5:4b

# Redis, donde viven los reportes a medio llenar
REDIS_URL=redis://127.0.0.1:6379

# API de SIPINNA, donde se registran los reportes confirmados
API_URL=https://api.sipinna.com

# Opcional: dónde esperan las fotos hasta enviarse (por defecto storage/photos)
# PHOTOS_DIR=storage/photos
```

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `ALLOWED_NUMBERS` | Sí | Números a los que el bot contesta. Los demás mensajes se ignoran. En México da igual escribir `52…` o `521…`: el bot reconoce los dos formatos |
| `LLM_MODEL` | Sí | Modelo de Ollama. `qwen3.5:4b` recomendado; `qwen2.5:3b` para equipos sin GPU |
| `REDIS_URL` | Sí | Si Redis no responde, el bot no arranca y dice por qué |
| `API_URL` | Sí | Dirección de la API de SIPINNA |
| `PHOTOS_DIR` | No | Carpeta temporal de fotos |

## Uso

| Comando | Para qué |
| --- | --- |
| `npm start` | Arranca el bot de WhatsApp |
| `npm run chat` | Conversa con el bot desde la terminal, sin WhatsApp (útil para probar) |

En el chat de terminal:

- `/location 19.5721,-99.2446` simula compartir una ubicación.
- `/draft` muestra el borrador actual.
- `/reset` empieza de nuevo.

En WhatsApp, `/reset` borra el reporte en curso (incluidas sus fotos).

> ⚠️ Con `API_URL` apuntando a producción, **cada reporte que se confirme durante las pruebas es real**: se registra en el sistema y notifica al personal de la zona.

## Estructura del proyecto

```
src/
  index.js                arranque: Redis, limpieza de fotos y conexión a WhatsApp
  config.js               lee el .env (todos los demás archivos toman la configuración de aquí)

  whatsapp/
    connection.js         conexión con Baileys, QR y reconexión automática
    message_handler.js    convierte cada mensaje de WhatsApp en { tipo, texto, ubicación, foto… }
    bot.js                responde cada mensaje: números permitidos, "escribiendo…", descarga de fotos, errores
    queue.js              procesa en orden los mensajes de una misma persona (en paralelo entre personas)

  report/
    conversation.js       un mensaje de principio a fin: extraer → borrador → reglas → respuesta → envío
    extractor.js          el modelo saca los datos del mensaje en un JSON fijo; el código los valida
    draft.js              el borrador del reporte y cómo se combinan los datos nuevos
    draftStore.js         guarda los borradores en Redis (caducan a las 2 h sin actividad)
    rules.js              decide el siguiente paso: qué preguntar, aproximaciones, fotos, resumen, 911
    writer.js             redacta las respuestas (modelo) y las plantillas fijas
    send.js               al confirmar: crea el reporte en la API, sube las fotos y lo envía
    photoStore.js         fotos en disco mientras se llena el reporte
    time.js               convierte "a las 5 de la tarde" en "17:00"
    categories.js         tipos de trabajo y rangos de edad
    referrals.js          canalización para temas fuera de alcance (911, 089, 088, DIF…)

  api/
    sipinnaApi.js         cliente de la API de SIPINNA

  llm/
    ollama.js             conexión con Ollama
    cli_chat.js           chat de terminal (npm run chat)
```

## Integración con la API de SIPINNA

Los reportes se registran como **anónimos** (sin sesión de usuario), en cuatro pasos:

```
1. POST /report                              → { reporte_id, edit_token }   (el reporte nace como borrador)
2. POST /report/:reporte_id/images           → ids de las imágenes          (solo si hay fotos)
3. PUT  /report/:reporte_id/images/:image_id → sube cada foto a S3, en paralelo
4. PUT  /report/:reporte_id/submit           → el reporte queda "registrado"
```

Del paso 2 en adelante se envía el header `X-Edit-Token` con el `edit_token` del paso 1.

Si un paso falla, el bot conserva el reporte y le pide a la persona que escriba *sí* para reintentar. El reintento **continúa el mismo reporte** en lugar de crear uno nuevo.

## Privacidad

- Los reportes se envían como anónimos: no llevan el nombre ni el número de la persona.
- En Redis, la llave de cada borrador es un hash del chat, no el número de teléfono.
- Los borradores se borran solos a las 2 horas sin actividad, y en cuanto el reporte se envía.
- Las fotos esperan en disco con nombres aleatorios. Se borran al enviarse el reporte, con `/reset`, o a las 24 horas si el reporte nunca se envió.
- Redis solo acepta conexiones desde la misma computadora.
- `.env`, la sesión de WhatsApp (`auth_info_baileys/`) y las fotos (`storage/`) están excluidos de git.

## Limitaciones conocidas

- **Folio:** la API no devuelve el folio de los reportes anónimos, así que el bot todavía no lo puede mostrar.
- **Fotos:** no se revisa automáticamente que no aparezcan rostros; el bot solo se lo pide a la persona.
- **Edades:** si los niños tienen edades distintas, se guarda un solo rango (la descripción conserva las edades exactas).
- **Valores:** los tipos de trabajo y rangos de edad del bot todavía no están alineados con los de la app de SIPINNA.
- **Historial:** la persona aún no puede consultar sus reportes anteriores desde el chat.

## Licencia

[MIT](LICENSE)
