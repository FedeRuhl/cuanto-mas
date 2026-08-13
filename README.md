# Cuánto más

Calculadora freelance para el mes en curso: sabés cuánto vas a cobrar, o cuánto te falta trabajar para llegar a tu objetivo.

Sin frameworks, sin build, sin backend. HTML, CSS y JavaScript.

## Qué hace

### Cuánto cobro
Ingresás tu **tarifa por hora** y las **horas trabajadas**. Te dice el total.

### Cuánto trabajar
Ingresás la **tarifa** y el **objetivo del mes**. Te dice cuántas horas necesitás y el promedio por día hábil.

Si cargás las **horas ya trabajadas** (opcional):

- Te muestra cuánto **te falta**
- Calcula el promedio sobre los **días hábiles que quedan** del mes
- Podés marcar **«Ya anoté las horas de hoy»** para que el promedio arranque desde el próximo hábil
- Ves el **progreso del mes** (% y monto acumulado vs. objetivo)

Los días hábiles son lunes a viernes, menos feriados nacionales argentinos (incluye trasladables y puentes cuando la API los trae). En la pestaña **Calendario** hay un calendario: hábil, no hábil y hoy. Si cargaste horas ya trabajadas, también se marcan los días hábiles que quedan.

## Cómo usarla

Desde esta carpeta:

```bash
python3 -m http.server 8080
```

Abrí [http://localhost:8080](http://localhost:8080).

> Conviene servirla por HTTP (y no abrir el archivo directo) para que el navegador pueda consultar los feriados sin problemas.

## Archivos

| Archivo | Rol |
|---------|-----|
| `index.html` | Estructura |
| `styles.css` | Estilos y animaciones |
| `app.js` | Cálculo, feriados, persistencia |

## Datos que se guardan

En el navegador (`localStorage`):

- Tarifa, horas, objetivo y modo activo
- Horas ya trabajadas
- Si marcaste que ya anotaste las de hoy (solo vale para esa fecha)
- Cache de feriados del año

No hay cuenta ni servidor: todo queda en tu dispositivo.

## Feriados

Se consultan en [ArgentinaDatos](https://argentinadatos.com/docs/operations/get-feriados):

```
GET https://api.argentinadatos.com/v1/feriados/{año}
```

Se cachean localmente. Si la API no responde, se usa un cálculo local de respaldo (feriados fijos, Pascua/Carnaval y trasladables según la Ley 27.399; sin puentes turísticos futuros).

## Requisitos

Cualquier navegador moderno. No hace falta instalar dependencias.
