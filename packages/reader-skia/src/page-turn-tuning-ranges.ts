import {
  MAX_CURVATURE_RELAXATION,
  MAX_GESTURE_COMMIT_THRESHOLD,
  MAX_GESTURE_IDLE_DECAY_SECONDS,
  MAX_GESTURE_MINIMUM_SPEED_SCALE,
  MAX_GESTURE_SPEED_SCALE,
  MAX_GESTURE_VELOCITY_GAIN,
  MAX_PAGE_TURN_LIFT_TO_LEFT,
  MAX_PAGE_TURN_LIFT_VELOCITY,
  MAX_PAGE_TURN_RELEASE_X,
  MAX_PAGE_WEIGHT,
  MIN_CURVATURE_RELAXATION,
  MIN_GESTURE_COMMIT_THRESHOLD,
  MIN_GESTURE_IDLE_DECAY_SECONDS,
  MIN_GESTURE_SPEED_SCALE,
  MIN_GESTURE_VELOCITY_GAIN,
  MIN_PAGE_TURN_LIFT_TO_LEFT,
  MIN_PAGE_TURN_LIFT_VELOCITY,
  MIN_PAGE_TURN_RELEASE_X,
  MIN_PAGE_WEIGHT,
} from "@chihumyum/page-turn-core";

export interface PageTurnTuningRange {
  readonly minimum: number;
  readonly maximum: number;
}

const forwardPhysicalRanges = {
  releaseX: {
    minimum: MIN_PAGE_TURN_RELEASE_X,
    maximum: MAX_PAGE_TURN_RELEASE_X,
  },
  liftVelocity: {
    minimum: MIN_PAGE_TURN_LIFT_VELOCITY,
    maximum: MAX_PAGE_TURN_LIFT_VELOCITY,
  },
  liftToLeft: {
    minimum: MIN_PAGE_TURN_LIFT_TO_LEFT,
    maximum: MAX_PAGE_TURN_LIFT_TO_LEFT,
  },
  curvatureRelaxation: {
    minimum: MIN_CURVATURE_RELAXATION,
    maximum: MAX_CURVATURE_RELAXATION,
  },
} as const;

export const FORWARD_CLICK_PAGE_TURN_TUNING_RANGES = {
  ...forwardPhysicalRanges,
  playbackSpeed: { minimum: 0.1, maximum: 6 },
} as const;

export const FORWARD_GESTURE_PAGE_TURN_TUNING_RANGES = {
  ...forwardPhysicalRanges,
  pageWeight: { minimum: MIN_PAGE_WEIGHT, maximum: MAX_PAGE_WEIGHT },
  commitThreshold: {
    minimum: MIN_GESTURE_COMMIT_THRESHOLD,
    maximum: MAX_GESTURE_COMMIT_THRESHOLD,
  },
  minimumSpeedScale: {
    minimum: MIN_GESTURE_SPEED_SCALE,
    maximum: MAX_GESTURE_MINIMUM_SPEED_SCALE,
  },
  maximumSpeedScale: {
    minimum: MIN_GESTURE_SPEED_SCALE,
    maximum: MAX_GESTURE_SPEED_SCALE,
  },
  velocityGain: {
    minimum: MIN_GESTURE_VELOCITY_GAIN,
    maximum: MAX_GESTURE_VELOCITY_GAIN,
  },
  idleDecaySeconds: {
    minimum: MIN_GESTURE_IDLE_DECAY_SECONDS,
    maximum: MAX_GESTURE_IDLE_DECAY_SECONDS,
  },
} as const;
