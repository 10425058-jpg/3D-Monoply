import { MathUtils, Matrix4, PerspectiveCamera, Quaternion, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three-stdlib';

export const MIN_ORBIT_DISTANCE = 16;
export const MAX_ORBIT_POLAR_ANGLE = Math.PI / 2.65;

const ORBIT_DECAY = 20;
const ZOOM_DECAY = 24;
const FOCUS_DECAY = 3.2;
const MAX_FRAME_DELTA = .05;

function approach(value: number, goal: number, blend: number, epsilon: number) {
  const next = MathUtils.lerp(value, goal, blend);
  return Math.abs(next - goal) <= epsilon ? goal : next;
}

/** OrbitControls handles gestures on a private input camera. Only the frame
 * loop publishes the damped pose to the world camera. */
export class BoardOrbitControls extends OrbitControls {
  private readonly updateInput: () => void;
  private readonly displayed = new Spherical();
  private readonly desired = new Spherical();
  private readonly position = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly lookAt = new Matrix4();
  private readonly focusPosition = new Vector3();
  private readonly focusTarget = new Vector3();
  private focusing = false;

  constructor(private readonly camera: PerspectiveCamera) {
    super(camera.clone());
    this.enablePan = false;
    this.rotateSpeed = .55;
    this.zoomSpeed = .7;
    this.minPolarAngle = .04;
    this.maxPolarAngle = MAX_ORBIT_POLAR_ANGLE;
    this.minDistance = MIN_ORBIT_DISTANCE;

    this.updateInput = this.update;
    this.update = () => {
      const position = this.object.position;
      const previousYaw = Math.atan2(position.x - this.target.x, position.z - this.target.z);
      this.updateInput();
      // Keep the signed input delta across the atan2 seam, including a drag
      // that accumulates more than half a turn between rendered frames.
      this.desired.theta += this.getAzimuthalAngle() - previousYaw;
      this.desired.phi = this.getPolarAngle();
      this.desired.radius = this.getDistance();
    };
    this.addEventListener('start', () => { this.focusing = false; });
  }

  focusOn(position: Vector3, target: Vector3) {
    this.focusPosition.copy(position);
    this.focusTarget.copy(target);
    this.focusing = true;
  }

  setPose(position: Vector3, target: Vector3) {
    this.focusing = false;
    this.syncPose(position, target);
  }

  step(delta: number, reducedMotion: boolean) {
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    if (dt <= 0 && !reducedMotion) return;

    if (this.focusing) {
      const blend = reducedMotion ? 1 : -Math.expm1(-FOCUS_DECAY * dt);
      this.position.copy(this.camera.position).lerp(this.focusPosition, blend);
      this.target.lerp(this.focusTarget, blend);
      if (this.position.distanceToSquared(this.focusPosition) < .0001 &&
        this.target.distanceToSquared(this.focusTarget) < .0001) {
        this.setPose(this.focusPosition, this.focusTarget);
      } else {
        this.syncPose(this.position, this.target);
      }
      return;
    }

    const current = this.displayed, goal = this.desired;
    if (current.theta === goal.theta && current.phi === goal.phi && current.radius === goal.radius) return;
    const orbitBlend = reducedMotion ? 1 : -Math.expm1(-ORBIT_DECAY * dt);
    const zoomBlend = reducedMotion ? 1 : -Math.expm1(-ZOOM_DECAY * dt);
    current.theta = approach(current.theta, goal.theta, orbitBlend, 1e-6);
    current.phi = approach(current.phi, goal.phi, orbitBlend, 1e-6);
    current.radius = approach(current.radius, goal.radius, zoomBlend, 1e-4);

    this.position.setFromSpherical(current).add(this.target);
    this.orientation.setFromRotationMatrix(this.lookAt.lookAt(this.position, this.target, this.camera.up));
    this.publishPose(this.position, this.orientation);
  }

  private syncPose(position: Vector3, target: Vector3) {
    this.target.copy(target);
    this.object.position.copy(position);
    this.updateInput();
    this.displayed.set(this.getDistance(), this.getPolarAngle(), this.getAzimuthalAngle());
    this.desired.copy(this.displayed);
    this.publishPose(this.object.position, this.object.quaternion);
  }

  private publishPose(position: Vector3, orientation: Quaternion) {
    this.camera.position.copy(position);
    this.camera.quaternion.copy(orientation);
    // Culling and view-dependent effects run after the camera in the same frame.
    this.camera.updateMatrixWorld();
  }
}
