let colorEstado = {
  sano: "lime",
  enfermo: "orange",
  recuperado: "cyan",
  muerto: "black",
};

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-3, 3), random(-3, 3));
    this.radio = 3;
    this.estado = "sano";
    this.tiempoenfermo = 0;
    this.movible = true;
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

    if (this.estado == "enfermo") {
      this.tiempoenfermo++;
    }

    if (
      this.estado == "enfermo" &&
      this.tiempoenfermo > root.tiempoenfermedad
    ) {
      this.muerto();
    }

    this.dibuja();
  }

  muerto() {
    if (random(1, 100) <= root.mortalidad) {
      this.estado = "muerto";
      this.movible = false;
      if (root.modozombie) {
        this.movible = true;
      }
    } else {
      this.estado = "recuperado";
      if (root.modozombie) {
        this.estado = "muerto";
        this.movible = true;
      }
    }
    this.vel.div(5);
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

      if (this.estado == "enfermo" || p.estado == "enfermo") {
        this.contagiado();
      }

      if (
        root.modozombie &&
        (this.estado == "muerto" || p.estado == "muerto")
      ) {
        this.contagiado();
      }

      this.vel.rotate(random(HALF_PI));
    }
    this.rebotarConParedes();
    p.rebotarConParedes();
  }

  contagiado() {
    if (this.estado == "sano") {
      this.estado = "enfermo";
    }
  }
}
