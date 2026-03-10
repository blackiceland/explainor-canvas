import {Code, makeScene2D, Node, Rect, Video} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {PanelStyle} from '../core/panelStyle';
import {Colors, Fonts, Screen, Timing} from '../core/theme';

const CLIP_URL = '/kling_20260215_Image_to_Video_train_goes_233_0.mp4';

const CODE_TEXT =
  'String processPayment(PaymentRequest request, String idempotencyKey, String traceId) {\n' +
  '  validateRequest(request);\n' +
  '  return prepareAndExecute(request, idempotencyKey, traceId);\n' +
  '}\n' +
  '\n' +
  'private String prepareAndExecute(PaymentRequest request, String idempotencyKey, String traceId) {\n' +
  '  UUID preparedPaymentId = preparePayment(request);\n' +
  '  return executeWithRetry(preparedPaymentId, idempotencyKey, traceId);\n' +
  '}';

export default makeScene2D(function* (view) {
  const root = createRef<Node>();
  const clip = createRef<Video>();
  const panel = createRef<Rect>();
  const on = createSignal(0);
  const ready = createSignal(false);

  const videoWidth = Screen.width;
  const videoHeight = Screen.height;
  const panelWidth = 1560;
  const panelHeight = 760;

  const KEYWORDS = new Set([
    'return',
    'private',
    'String',
  ]);
  const TYPES = new Set([
    'PaymentRequest',
    'UUID',
  ]);
  const base = 'rgba(244,241,235,0.76)';
  const punctuation = 'rgba(244,241,235,0.56)';
  const keyword = 'rgba(163,205,255,0.86)';
  const method = Colors.accent;
  const type = 'rgba(201,180,255,0.82)';

  view.add(
    <Node ref={root} opacity={() => on()}>
      <Rect width={videoWidth} height={videoHeight} x={0} y={0} clip radius={0} fill={'rgba(0,0,0,0)'}>
        <Video
          ref={clip}
          src={CLIP_URL}
          width={videoWidth}
          height={videoHeight}
          ratio={16 / 9}
          alpha={() => (ready() ? 1 : 0)}
          smoothing
          radius={0}
          scale={1.06}
          x={0}
          y={0}
        />
      </Rect>

      <Rect
        ref={panel}
        x={0}
        y={25}
        width={panelWidth}
        height={panelHeight}
        radius={PanelStyle.radiusSmall}
        fill={'rgba(10, 12, 16, 0.58)'}
        stroke={'rgba(244, 241, 235, 0.16)'}
        lineWidth={1}
        shadowColor={'rgba(0,0,0,0.45)'}
        shadowBlur={34}
        shadowOffset={[0, 14]}
        opacity={0}
        clip
      >
        <Code
          code={CODE_TEXT}
          width={panelWidth - 120}
          x={0}
          y={0}
          fontFamily={Fonts.code}
          fontSize={24}
          lineHeight={36}
          opacity={0.94}
          drawHooks={{
            token: (
              ctx: CanvasRenderingContext2D,
              text: string,
              position: {x: number; y: number},
            ) => {
              const raw = String(text ?? '');
              let x = position.x;
              const y = position.y;

              const flush = (segment: string, color: string) => {
                if (!segment) return;
                ctx.fillStyle = color;
                ctx.fillText(segment, x, y);
                x += ctx.measureText(segment).width;
              };

              let i = 0;
              while (i < raw.length) {
                const ch = raw[i];

                if (/[A-Za-z_]/.test(ch)) {
                  let j = i + 1;
                  while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
                  const word = raw.slice(i, j);
                  if (KEYWORDS.has(word)) flush(word, keyword);
                  else if (TYPES.has(word)) flush(word, type);
                  else if (word === 'processPayment' || word === 'validateRequest' || word === 'prepareAndExecute' || word === 'preparePayment' || word === 'executeWithRetry')
                    flush(word, method);
                  else flush(word, base);
                  i = j;
                  continue;
                }

                if (ch === '(' || ch === ')' || ch === ',' || ch === ';' || ch === '{' || ch === '}' || ch === '=') {
                  flush(ch, punctuation);
                  i += 1;
                  continue;
                }

                flush(ch, base);
                i += 1;
              }
            },
          }}
        />
      </Rect>
    </Node>,
  );

  yield clip().toPromise();
  ready(true);
  clip().loop(true);
  clip().play();

  on(0);
  panel().opacity(0);
  yield* waitFor(0.1);
  yield* on(1, Math.max(0.7, Timing.slow * 0.78), easeInOutCubic);
  yield* panel().opacity(1, Math.max(0.85, Timing.slow), easeInOutCubic);
  yield* waitFor(2.3);
  yield* all(
    panel().opacity(0, Math.max(0.65, Timing.slow * 0.7), easeInOutCubic),
    on(0, Math.max(0.65, Timing.slow * 0.7), easeInOutCubic),
  );
});
