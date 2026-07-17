# Cuánto más

Calculadora simple de sueldos freelance: tarifa por hora, horas trabajadas u objetivo del mes, con días hábiles del mes actual (Lun–Vie menos feriados argentinos).

Los feriados se obtienen de [ArgentinaDatos](https://argentinadatos.com/docs/operations/get-feriados) (`/v1/feriados/{año}`), se cachean en el navegador y, si la API falla, se usa un cálculo local de respaldo.

## Uso

Abrí `index.html` en el navegador, o desde esta carpeta:

```bash
python3 -m http.server 8080
```

Después visitá [http://localhost:8080](http://localhost:8080).

Los parámetros se guardan solos en el navegador (`localStorage`).
