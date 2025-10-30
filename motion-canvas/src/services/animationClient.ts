type KeyframeResponse = {
  timeSeconds: number;
  value: number;
  easing: string;
};

type PropertyTweenResponse = {
  propertyName: string;
  keyframes: KeyframeResponse[];
};

type CirclePropertiesResponse = {
  centerX: number;
  centerY: number;
  radius: number;
  strokeColor: string;
  fillColor: string;
};

type ElementResponse = {
  elementId: string;
  primitiveType: string;
  startSeconds: number;
  durationSeconds: number;
  circle: CirclePropertiesResponse;
  tweens: PropertyTweenResponse[];
};

export type SceneResponse = {
  sceneId: string;
  name: string;
  durationSeconds: number;
  elements: ElementResponse[];
};

const defaultScene: SceneResponse = {
  sceneId: 'local-circle-slide',
  name: 'circle-slide',
  durationSeconds: 2.4,
  elements: [
    {
      elementId: 'local-circle',
      primitiveType: 'CIRCLE',
      startSeconds: 0,
      durationSeconds: 2.4,
      circle: {
        centerX: 0,
        centerY: 0,
        radius: 160,
        strokeColor: '#1F2933',
        fillColor: '#61DAFB'
      },
      tweens: [
        {
          propertyName: 'positionX',
          keyframes: [
            {
              timeSeconds: 0,
              value: -320,
              easing: 'easeInOut'
            },
            {
              timeSeconds: 2.4,
              value: 320,
              easing: 'easeInOut'
            }
          ]
        }
      ]
    }
  ]
};

const fallbackBaseUrl = 'http://localhost:8081';

export async function fetchCircleSlideScene(baseUrl?: string): Promise<SceneResponse> {
  const resolvedBaseUrl = baseUrl ?? import.meta.env.VITE_BACKEND_URL ?? fallbackBaseUrl;
  try {
    const response = await fetch(`${resolvedBaseUrl}/api/v1/animations/circle-slide`);
    if (!response.ok) {
      return defaultScene;
    }
    return (await response.json()) as SceneResponse;
  } catch (error) {
    return defaultScene;
  }
}

