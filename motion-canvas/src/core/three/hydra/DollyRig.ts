// Hydra / DollyRig — камера одним движением: отход назад с подъёмом.
//
// Не облёт и не восьмёрка — один непрерывный жест. Вынос растёт
// экспоненциально, так отъезд ощущается равномерным на всех масштабах. Угол
// обзора может сужаться вместе с отходом: тогда перспектива к финалу почти
// вырождается в параллельную проекцию, и кадр читается как отпечаток, а не как
// пролёт.
//
// ⚠️ Цель первого кадра обязана лежать НА поверхности (высота из поля), а не
// на нуле: иначе камера смотрит в точку под рельефом и первые секунды снимает
// пустоту.

import {PerspectiveCamera, Vector3} from 'three';

export interface DollySpec {
  /** Азимут, рад. Не ноль: ровно фронтальный взгляд ставит решётку в муар. */
  az: number;
  el0: number;
  el1: number;
  len0: number;
  len1: number;
  fov0: number;
  fov1: number;
  tgt0: Vector3;
  tgt1: Vector3;
}

export interface DollyPose {
  len: number;
  el: number;
  fov: number;
}

export class DollyRig {
  private readonly tgt = new Vector3();

  constructor(readonly spec: DollySpec, readonly camera: PerspectiveCamera) {}

  /** p — 0..1, весь путь. Ставит камеру и возвращает позу. */
  apply(p: number): DollyPose {
    const s = this.spec;
    const el = s.el0 + (s.el1 - s.el0) * p;
    const len = s.len0 * Math.pow(s.len1 / s.len0, p);
    const fov = s.fov0 * Math.pow(s.fov1 / s.fov0, p);

    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.tgt.lerpVectors(s.tgt0, s.tgt1, p);
    const ce = Math.cos(el);
    this.camera.position.set(
      this.tgt.x + Math.sin(s.az) * ce * len,
      this.tgt.y + Math.sin(el) * len,
      this.tgt.z + Math.cos(s.az) * ce * len,
    );
    this.camera.lookAt(this.tgt);
    return {len, el, fov};
  }
}
