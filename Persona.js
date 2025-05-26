const ESTADOS = Object.freeze({
  SANO: "sano",
  ENFERMO: "enfermo",
  RECUPERADO: "recuperado",
  MUERTO: "muerto",
});

const colorEstado = {
  [ESTADOS.SANO]: "lime",
  [ESTADOS.ENFERMO]: "orange",
  [ESTADOS.RECUPERADO]: "cyan",
  [ESTADOS.MUERTO]: "black",
};

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-3, 3), random(-3, 3));
    this.radio = 3;
    this.estado = ESTADOS.SANO;
    this.tiempoenfermo = 0;
    this.movible = true;
  }

  setEstado(nuevoEstado) {
    this.estado = nuevoEstado;
    switch (nuevoEstado) {
      case ESTADOS.MUERTO:
        this.movible = !!root.modozombie;
        break;
    }
    if (nuevoEstado === ESTADOS.MUERTO || nuevoEstado === ESTADOS.RECUPERADO) {
      this.vel.div(5);
    }
  }

  dibuja() {
    fill(colorEstado[this.estado]);
    stroke("black");
    ellipse(this.pos.x, this.pos.y, this.radio * 2, this.radio * 2);
  }

  update() {
    if (this.movible) {
      this.pos.add(this.vel);
      this.rebotarConParedes();
    }

    if (this.estado === ESTADOS.ENFERMO) {
      this.tiempoenfermo++;
      if (this.tiempoenfermo > root.tiempoenfermedad) {
        this.resolverEnfermedad();
      }
    }

    this.dibuja();
  }

  resolverEnfermedad() {
    if (random(1, 100) <= root.mortalidad) {
      this.setEstado(ESTADOS.MUERTO);
    } else {
      if (root.modozombie) {
        this.setEstado(ESTADOS.MUERTO);
      } else {
        this.setEstado(ESTADOS.RECUPERADO);
      }
    }
  }

  rebotarConParedes() {
    const { pos, radio, vel } = this;
    const maxX = width - radio;
    const maxY = height - radio;

    if (pos.x - radio <= 0 || pos.x + radio >= maxX) {
      vel.x *= -1;
      pos.x = constrain(pos.x, radio, maxX);
    }

    if (pos.y - radio <= 0 || pos.y + radio >= maxY) {
      vel.y *= -1;
      pos.y = constrain(pos.y, radio, maxY);
    }
  }

  colisiona(p) {
    const distancia = dist(this.pos.x, this.pos.y, p.pos.x, p.pos.y);
    const sumaRadios = this.radio + p.radio;
    if (distancia <= sumaRadios) {
      const direccion = createVector(
        this.pos.x - p.pos.x,
        this.pos.y - p.pos.y
      );
      direccion.setMag(sumaRadios - distancia);
      this.pos.add(direccion);

      if (this.estado === ESTADOS.ENFERMO || p.estado === ESTADOS.ENFERMO) {
        this.contagiado();
      }

      if (
        root.modozombie &&
        (this.estado === ESTADOS.MUERTO || p.estado === ESTADOS.MUERTO)
      ) {
        this.contagiado();
      }

      this.vel.rotate(random(HALF_PI));
    }
    this.rebotarConParedes();
    p.rebotarConParedes();
  }

  contagiado() {
    if (this.estado === ESTADOS.SANO) {
      this.setEstado(ESTADOS.ENFERMO);
    }
  }
}
