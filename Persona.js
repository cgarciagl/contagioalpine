const ESTADOS = Object.freeze({
  SANO: "sano",
  ENFERMO: "enfermo",
  RECUPERADO: "recuperado",
  MUERTO: "muerto",
});

const colorEstado = {
  [ESTADOS.SANO]: "#3b82f6",      // Azul
  [ESTADOS.ENFERMO]: "#f43f5e",   // Rojo/Rosa
  [ESTADOS.RECUPERADO]: "#10b981", // Verde
  [ESTADOS.MUERTO]: "#64748b",    // Gris
};

const colorEstadoRGB = {
  [ESTADOS.SANO]: [59, 130, 246],      // #3b82f6
  [ESTADOS.ENFERMO]: [244, 63, 94],    // #f43f5e
  [ESTADOS.RECUPERADO]: [16, 185, 129], // #10b981
  [ESTADOS.MUERTO]: [100, 116, 139],    // #64748b
};

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-4, 4), random(-4, 4));
    this.radio = 4;
    this.estado = ESTADOS.SANO;
    this.tiempoenfermo = 0;
    this.movible = true;

    // Optimización: punto de Quadtree pre-guardado para evitar 'new Point' en cada frame
    this.quadTreePoint = new Point(x, y, this);
  }

  setEstado(nuevoEstado) {
    this.estado = nuevoEstado;
    if (nuevoEstado === ESTADOS.MUERTO) {
      this.movible = !!root.modozombie;
      if (!root.modozombie) {
        this.vel.mult(0);
      }
    }
    
    // Slow down recovered or dead
    if (nuevoEstado === ESTADOS.RECUPERADO) {
      this.vel.mult(0.5);
    }
  }

  dibuja() {
    push();
    noStroke();
    
    const rgb = colorEstadoRGB[this.estado];

    fill(rgb[0], rgb[1], rgb[2]);
    stroke(255, 80);
    strokeWeight(1);
    ellipse(this.pos.x, this.pos.y, this.radio * 2, this.radio * 2);
    pop();
  }

  update() {
    if (this.movible) {
      // Aritmética directa de componentes (evita instanciar un nuevo vector con p5.Vector.mult)
      const velFactor = root.velocidad || 1;
      this.pos.x += this.vel.x * velFactor;
      this.pos.y += this.vel.y * velFactor;

      this.rebotarConParedes();
    }

    // Mantener la posición del punto Quadtree sincronizada para la detección de colisiones
    this.quadTreePoint.x = this.pos.x;
    this.quadTreePoint.y = this.pos.y;

    if (this.estado === ESTADOS.ENFERMO) {
      this.tiempoenfermo++;
      if (this.tiempoenfermo > root.tiempoenfermedad) {
        this.resolverEnfermedad();
      }
    }

    this.dibuja();
  }

  resolverEnfermedad() {
    if (random(0, 100) <= root.mortalidad) {
      this.setEstado(ESTADOS.MUERTO);
    } else {
      // In zombie mode, everyone who would be "recovered" becomes dead but movible
      if (root.modozombie) {
        this.setEstado(ESTADOS.MUERTO);
      } else {
        this.setEstado(ESTADOS.RECUPERADO);
      }
    }
  }

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

  colisiona(p) {
    // Optimización: Primero verificar con la distancia al cuadrado (evita Math.sqrt/dist en la mayoría de casos)
    const dx = this.pos.x - p.pos.x;
    const dy = this.pos.y - p.pos.y;
    const dSq = dx * dx + dy * dy;
    const minD = this.radio + p.radio;
    const minDSq = minD * minD;
    
    if (dSq < minDSq) {
      const d = Math.sqrt(dSq);
      // Prevent overlapping
      const overlap = minD - d;
      
      // Optimización: Aritmética directa de componentes (evita instanciar p5.Vector y .setMag)
      if (d > 0) {
        const moveX = (dx / d) * (overlap / 2);
        const moveY = (dy / d) * (overlap / 2);
        this.pos.x += moveX;
        this.pos.y += moveY;
        p.pos.x -= moveX;
        p.pos.y -= moveY;
      }

      // Infection logic
      if (this.estado === ESTADOS.ENFERMO || p.estado === ESTADOS.ENFERMO) {
        this.intentarContagio();
        p.intentarContagio();
      }

      if (root.modozombie && (this.estado === ESTADOS.MUERTO || p.estado === ESTADOS.MUERTO)) {
        this.intentarContagio();
        p.intentarContagio();
      }

      // Simple elastic collision response (randomized for variety)
      this.vel.rotate(random(-PI/8, PI/8));
      p.vel.rotate(random(-PI/8, PI/8));
    }
  }

  intentarContagio() {
    if (this.estado === ESTADOS.SANO) {
      this.setEstado(ESTADOS.ENFERMO);
    }
  }
}
