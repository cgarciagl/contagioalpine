const ESTADOS = Object.freeze({
  SANO: "sano",
  ENFERMO: "enfermo",
  RECUPERADO: "recuperado",
  MUERTO: "muerto",
});

const COLOR_ESTADO = Object.freeze({
  [ESTADOS.SANO]:       { hex: "#3b82f6", rgb: [59, 130, 246] },
  [ESTADOS.ENFERMO]:    { hex: "#f43f5e", rgb: [244, 63, 94] },
  [ESTADOS.RECUPERADO]: { hex: "#10b981", rgb: [16, 185, 129] },
  [ESTADOS.MUERTO]:     { hex: "#64748b", rgb: [100, 116, 139] },
});

const RADIO_PERSONA = 4;
const VELOCIDAD_INICIAL_MAX = 4;
const EPSILON_DISTANCIA = 0.001;
const EPSILON_CROSS = 0.0001;
const SEPARACION_BARRERA = 0.5;
const VELOCIDAD_RECUPERADO = 0.5;

const AURA_ENFERMO_OPACIDAD = 30;
const AURA_ENFERMO_AMPLITUD = 3;
const AURA_ENFERMO_BASE = 5;
const AURA_ENFERMO_FRECUENCIA = 0.1;

const AURA_ZOMBI_OPACIDAD = 45;
const AURA_ZOMBI_AMPLITUD = 2;
const AURA_ZOMBI_BASE = 4;
const AURA_ZOMBI_FRECUENCIA = 0.15;

const ANILLO_OPACIDAD = 180;
const ANILLO_RADIO_EXTRA = 4;
const ANILLO_PESO = 1.5;

const CONTORNO_OPACIDAD = 120;
const CONTORNO_PESO = 1;

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-VELOCIDAD_INICIAL_MAX, VELOCIDAD_INICIAL_MAX), random(-VELOCIDAD_INICIAL_MAX, VELOCIDAD_INICIAL_MAX));
    this.radio = RADIO_PERSONA;
    this.estado = ESTADOS.SANO;
    this.tiempoEnfermo = 0;
    this.movible = true;
    this.infectadosDirectos = 0;
    this.infectadoPor = null;

    // Punto de Quadtree pre-guardado para evitar 'new Point' en cada frame
    this.quadTreePoint = new Point(x, y, this);
  }

  setEstado(nuevoEstado) {
    this.estado = nuevoEstado;
    if (nuevoEstado === ESTADOS.MUERTO) {
      this.movible = Boolean(simulationStore.modozombie);
      if (!simulationStore.modozombie) {
        this.vel.mult(0);
      }
      return;
    }

    if (nuevoEstado === ESTADOS.RECUPERADO) {
      this.vel.mult(VELOCIDAD_RECUPERADO);
    }
  }

  // --- Dibujo ---

  dibuja() {
    const rgb = COLOR_ESTADO[this.estado].rgb;
    this._dibujarAura(rgb);
    this._dibujarAnilloCuarentena(rgb);
    this._dibujarCuerpo(rgb);
  }

  _dibujarAura(rgb) {
    if (this.estado === ESTADOS.ENFERMO) {
      this._dibujarAuraPulso(rgb, AURA_ENFERMO_FRECUENCIA, AURA_ENFERMO_AMPLITUD, AURA_ENFERMO_BASE, AURA_ENFERMO_OPACIDAD);
    } else if (this.estado === ESTADOS.MUERTO && this.movible) {
      const zombiRgb = COLOR_ESTADO[ESTADOS.RECUPERADO].rgb;
      this._dibujarAuraPulso(zombiRgb, AURA_ZOMBI_FRECUENCIA, AURA_ZOMBI_AMPLITUD, AURA_ZOMBI_BASE, AURA_ZOMBI_OPACIDAD);
    }
  }

  _dibujarAuraPulso(rgb, frecuencia, amplitud, base, opacidad) {
    push();
    noStroke();
    const pulso = sin(frameCount * frecuencia) * amplitud + base;
    fill(rgb[0], rgb[1], rgb[2], opacidad);
    ellipse(this.pos.x, this.pos.y, (this.radio + pulso) * 2, (this.radio + pulso) * 2);
    pop();
  }

  _dibujarAnilloCuarentena(rgb) {
    if (this.movible || this.estado === ESTADOS.MUERTO) return;

    push();
    noFill();
    stroke(rgb[0], rgb[1], rgb[2], ANILLO_OPACIDAD);
    strokeWeight(ANILLO_PESO);
    this._aplicarLineaDiscontinua([4, 3]);
    ellipse(this.pos.x, this.pos.y, (this.radio + ANILLO_RADIO_EXTRA) * 2, (this.radio + ANILLO_RADIO_EXTRA) * 2);
    this._aplicarLineaDiscontinua([]);
    pop();
  }

  _dibujarCuerpo(rgb) {
    push();
    fill(rgb[0], rgb[1], rgb[2]);
    stroke(255, CONTORNO_OPACIDAD);
    strokeWeight(CONTORNO_PESO);
    ellipse(this.pos.x, this.pos.y, this.radio * 2, this.radio * 2);
    pop();
  }

  _aplicarLineaDiscontinua(patron) {
    if (drawingContext && drawingContext.setLineDash) {
      drawingContext.setLineDash(patron);
    }
  }

  // --- Actualización ---

  update() {
    if (this.movible) {
      const factorVelocidad = simulationStore.velocidad || 1;
      const oldX = this.pos.x;
      const oldY = this.pos.y;
      this.pos.x += this.vel.x * factorVelocidad;
      this.pos.y += this.vel.y * factorVelocidad;
      this.rebotarConParedes();
      this.rebotarConBarreras(oldX, oldY);
    }

    this.quadTreePoint.x = this.pos.x;
    this.quadTreePoint.y = this.pos.y;

    if (this.estado === ESTADOS.ENFERMO) {
      this.tiempoEnfermo++;
      if (this.tiempoEnfermo > simulationStore.tiempoenfermedad) {
        this.resolverEnfermedad();
      }
    }

    this.dibuja();
  }

  // --- Resolución de enfermedad ---

  resolverEnfermedad() {
    if (random(0, 100) <= simulationStore.mortalidad) {
      this.setEstado(ESTADOS.MUERTO);
    } else if (simulationStore.modozombie) {
      this.setEstado(ESTADOS.MUERTO);
    } else {
      this.setEstado(ESTADOS.RECUPERADO);
    }

    if (window.registrarResolucionInfeccion) {
      window.registrarResolucionInfeccion(this.infectadosDirectos);
    }
  }

  // --- Rebote con bordes del canvas ---

  rebotarConParedes() {
    if (this.pos.x < this.radio || this.pos.x > width - this.radio) {
      this.vel.x *= -1;
      this.pos.x = constrain(this.pos.x, this.radio, width - this.radio);
    }
    if (this.pos.y < this.radio || this.pos.y > height - this.radio) {
      this.vel.y *= -1;
      this.pos.y = constrain(this.pos.y, this.radio, height - this.radio);
    }
  }

  // --- Rebote con barreras (colisión continua para evitar atravesar muros) ---

  rebotarConBarreras(oldX, oldY) {
    if (!simulationStore || !simulationStore.barreras || simulationStore.barreras.length === 0) return;

    const movX = this.pos.x - oldX;
    const movY = this.pos.y - oldY;
    const movLen = Math.sqrt(movX * movX + movY * movY);

    if (movLen < EPSILON_DISTANCIA) {
      for (const barrera of simulationStore.barreras) {
        this._resolverSuperposicionEstatica(barrera);
      }
      return;
    }

    const movDirX = movX / movLen;
    const movDirY = movY / movLen;

    for (const barrera of simulationStore.barreras) {
      this._colisionContinuaConBarrera(barrera, oldX, oldY, movDirX, movDirY, movLen);
    }
  }

  _colisionContinuaConBarrera(barrera, oldX, oldY, movDirX, movDirY, movLen) {
    const barX = barrera.x2 - barrera.x1;
    const barY = barrera.y2 - barrera.y1;
    const barLenSq = barX * barX + barY * barY;
    if (barLenSq < EPSILON_DISTANCIA) return;

    // Componente del movimiento perpendicular a la barrera
    const crossMov = movDirX * barY - movDirY * barX;
    if (Math.abs(crossMov) < EPSILON_CROSS) return;

    const startX = oldX - barrera.x1;
    const startY = oldY - barrera.y1;
    const crossStart = startX * barY - startY * barX;
    const tHit = -crossStart / crossMov;

    if (tHit < -this.radio || tHit > movLen + this.radio) return;

    const tClamped = constrain(tHit, 0, movLen);
    const hitX = oldX + movDirX * tClamped;
    const hitY = oldY + movDirY * tClamped;

    const { closestX, closestY, dx, dy, distSq } = this._puntoMasCercanoEnBarrera(barrera, barX, barY, barLenSq, hitX, hitY);

    if (distSq >= this.radio * this.radio) return;

    const dist = Math.sqrt(distSq);

    if (dist > EPSILON_DISTANCIA) {
      const nx = dx / dist;
      const ny = dy / dist;
      this.pos.x = closestX + nx * (this.radio + SEPARACION_BARRERA);
      this.pos.y = closestY + ny * (this.radio + SEPARACION_BARRERA);

      const dot = this.vel.x * nx + this.vel.y * ny;
      if (dot < 0) {
        this.vel.x -= 2 * dot * nx;
        this.vel.y -= 2 * dot * ny;
      }
    } else {
      this.pos.x = hitX - movDirX * this.radio;
      this.pos.y = hitY - movDirY * this.radio;
      this.vel.x *= -1;
      this.vel.y *= -1;
    }
  }

  _resolverSuperposicionEstatica(barrera) {
    const barX = barrera.x2 - barrera.x1;
    const barY = barrera.y2 - barrera.y1;
    const barLenSq = barX * barX + barY * barY;
    if (barLenSq < EPSILON_DISTANCIA) return;

    const { closestX, closestY, dx, dy, distSq } = this._puntoMasCercanoEnBarrera(barrera, barX, barY, barLenSq, this.pos.x, this.pos.y);

    if (distSq >= this.radio * this.radio || distSq < EPSILON_DISTANCIA) return;

    const dist = Math.sqrt(distSq);
    const overlap = this.radio - dist;
    this.pos.x += (dx / dist) * overlap;
    this.pos.y += (dy / dist) * overlap;

    const nx = dx / dist;
    const ny = dy / dist;
    const dot = this.vel.x * nx + this.vel.y * ny;
    if (dot < 0) {
      this.vel.x -= 2 * dot * nx;
      this.vel.y -= 2 * dot * ny;
    }
  }

  _puntoMasCercanoEnBarrera(barrera, barX, barY, barLenSq, puntoX, puntoY) {
    const desdeInicioX = puntoX - barrera.x1;
    const desdeInicioY = puntoY - barrera.y1;
    let proj = (desdeInicioX * barX + desdeInicioY * barY) / barLenSq;
    proj = constrain(proj, 0, 1);

    const closestX = barrera.x1 + proj * barX;
    const closestY = barrera.y1 + proj * barY;
    const dx = puntoX - closestX;
    const dy = puntoY - closestY;
    const distSq = dx * dx + dy * dy;

    return { closestX, closestY, dx, dy, distSq };
  }

  // --- Colisión con otra persona ---

  colisiona(otraPersona) {
    const dx = this.pos.x - otraPersona.pos.x;
    const dy = this.pos.y - otraPersona.pos.y;
    const distanciaCuadrada = dx * dx + dy * dy;
    const distanciaMinima = this.radio + otraPersona.radio;
    const distanciaMinimaCuadrada = distanciaMinima * distanciaMinima;

    if (distanciaCuadrada >= distanciaMinimaCuadrada) return;

    const distancia = Math.sqrt(distanciaCuadrada);
    this._resolverSuperposicionMutua(otraPersona, dx, dy, distancia, distanciaMinima);
    this._intentarContagioMutuo(otraPersona);

    this.vel.rotate(random(-PI / 8, PI / 8));
    otraPersona.vel.rotate(random(-PI / 8, PI / 8));
  }

  _resolverSuperposicionMutua(otraPersona, dx, dy, distancia, distanciaMinima) {
    if (distancia <= 0) return;

    const overlap = distanciaMinima - distancia;
    const moveX = (dx / distancia) * (overlap / 2);
    const moveY = (dy / distancia) * (overlap / 2);
    this.pos.x += moveX;
    this.pos.y += moveY;
    otraPersona.pos.x -= moveX;
    otraPersona.pos.y -= moveY;
  }

  _intentarContagioMutuo(otraPersona) {
    const thisEnfermo = this.estado === ESTADOS.ENFERMO;
    const otraEnfermo = otraPersona.estado === ESTADOS.ENFERMO;
    const thisZombi = simulationStore.modozombie && this.estado === ESTADOS.MUERTO && this.movible;
    const otraZombi = simulationStore.modozombie && otraPersona.estado === ESTADOS.MUERTO && otraPersona.movible;

    if ((thisEnfermo || thisZombi) && otraPersona.estado === ESTADOS.SANO) {
      otraPersona.intentarContagio(this);
    } else if ((otraEnfermo || otraZombi) && this.estado === ESTADOS.SANO) {
      this.intentarContagio(otraPersona);
    }
  }

  // --- Contagio ---

  intentarContagio(infector) {
    if (this.estado !== ESTADOS.SANO) return;

    const probabilidad = simulationStore.tasacontagio !== undefined ? simulationStore.tasacontagio : 100;
    if (random(0, 100) > probabilidad) return;

    this.setEstado(ESTADOS.ENFERMO);
    this.tiempoEnfermo = 0;

    if (infector) {
      this.infectadoPor = infector;
      infector.infectadosDirectos = (infector.infectadosDirectos || 0) + 1;
    }
  }
}
