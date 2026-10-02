# Canelistico TCG - Portal de Resultados de Torneos

Aplicación web desarrollada en Node.js y JavaScript para mostrar los resultados de los torneos de cartas coleccionables de **Canelistico**.

## Características
- **Página de Inicio**: Diseño minimalista oscuro con modal centrado que cubre el 75% de la pantalla.
- **Cuadrícula de Juegos**: 4 tarjetas cuadradas estilizadas según la referencia gráfica, en el orden:
  1. `Riftbound`
  2. `Pokémon`
  3. `Digimon`
  4. `Lorcana`
- **Página de Resultados de Torneo**:
  - Vista centrada ocupando el 80% de la pantalla.
  - Título dinámico correspondiente al juego seleccionado (ej. *Digimon*, *Pokémon*, *Riftbound*, *Lorcana*).
  - Tabla con columnas: `Puesto`, `Jugador`, `Deck`, `Puntos`.
  - 16 filas con datos de ejemplo: `"1"`, `"Gusifer"`, `"Viktor"`, `"666"`.
  - Búsqueda en tiempo real por jugador o deck.
  - Botón de retorno a la selección de juegos.
- **Servidor Node.js**: Sin dependencias externas pesadas, soporte para API REST y servicio de estáticos.

## Cómo ejecutar

```bash
# Iniciar el servidor
node server.js
```

Abre tu navegador en: [http://localhost:3000](http://localhost:3000)
