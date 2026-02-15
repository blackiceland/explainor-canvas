import {makeScene2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const CODE_CARD_STYLE = {
  radius: 24,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

const TRACE_PINK = '#FF8CA3';
const TRACE_PINK_SOFT = 'rgba(255, 140, 163, 0.72)';

const MONOLITH_CODE = `final class PipelineFlow {

  Result run(Task task, String traceId) {
    check(task);
    return stageA(task, traceId);
  }

  private Result stageA(Task task, String traceId) {
    Header header = buildHeader(task, traceId);
    return stageB(task, header, traceId);
  }

  private Header buildHeader(Task task, String traceId) {
    String id = normalize(task.id());
    return new Header(id, traceId);
  }

  private Result stageB(Task task, Header header, String traceId) {
    Meta meta = enrich(header, traceId);
    return stageC(task, meta, traceId);
  }

  private Meta enrich(Header header, String traceId) {
    Meta meta = new Meta(header.id(), header.trace());
    meta.attach("trace", traceId);
    return meta;
  }

  private Result stageC(Task task, Meta meta, String traceId) {
    Payload payload = compose(task, meta, traceId);
    return stageD(payload, traceId);
  }

  private Payload compose(Task task, Meta meta, String traceId) {
    Payload payload = new Payload(task.name(), meta);
    payload.setTag(traceId);
    return payload;
  }

  private Result stageD(Payload payload, String traceId) {
    Packet packet = serialize(payload, traceId);
    return stageE(packet, traceId);
  }

  private Packet serialize(Payload payload, String traceId) {
    byte[] raw = payload.bytes();
    return new Packet(raw, traceId);
  }

  private Result stageE(Packet packet, String traceId) {
    GatewayRequest req = toGateway(packet, traceId);
    return stageF(req, traceId);
  }

  private GatewayRequest toGateway(Packet packet, String traceId) {
    GatewayRequest req = new GatewayRequest(packet.body());
    req.setTrace(traceId);
    return req;
  }

  private Result stageF(GatewayRequest req, String traceId) {
    GatewayResponse rsp = dispatch(req, traceId);
    return stageG(rsp, traceId);
  }

  private GatewayResponse dispatch(GatewayRequest req, String traceId) {
    return gateway.send(req, traceId);
  }

  private Result stageG(GatewayResponse rsp, String traceId) {
    Stored stored = persist(rsp, traceId);
    return finish(stored, traceId);
  }

  private Stored persist(GatewayResponse rsp, String traceId) {
    Stored stored = store(rsp.id(), rsp.code());
    // first real ownership: traceId is finally consumed here
    audit.log(traceId);
    return stored;
  }

  private Result finish(Stored stored, String traceId) {
    return new Result(stored.id());
  }

  private void check(Task task) {}
  private String normalize(String value) { return value; }
  private Stored store(String id, int code) { return new Stored(id); }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize = 28;
  const lineHeight = Math.round(fontSize * 1.55 * 10) / 10;
  const paddingY = getCodePaddingY(fontSize);

  const blockHeight = SafeZone.bottom - SafeZone.top - 40;
  const blockWidth = SafeZone.right - SafeZone.left;
  const topInset = Math.max(8, paddingY - 6);

  const monolith = CodeBlock.fromCode(MONOLITH_CODE, {
    x: 0,
    y: 0,
    width: blockWidth,
    height: blockHeight,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: [
      'PipelineFlow',
      'Result',
      'Task',
      'Header',
      'Meta',
      'Payload',
      'Packet',
      'GatewayRequest',
      'GatewayResponse',
      'Stored',
    ],
  });

  monolith.mount(view);
  yield* monolith.appear(Timing.normal);

  const lines = MONOLITH_CODE.split('\n');
  const traceLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('traceId')) traceLines.push(i);
  }
  const useLine = lines.findIndex(line => line.includes('audit.log(traceId)'));

  for (const idx of traceLines.slice(0, 2)) {
    yield* monolith.recolorTokens(idx, ['traceId'], TRACE_PINK, 0.35);
  }

  const clipHeight = blockHeight - paddingY * 2;
  const targetLastY = clipHeight / 2 - lineHeight / 2 - 12;
  const currentLastY = -((lines.length - 1) / 2) * lineHeight + (lines.length - 1) * lineHeight;
  const scrollAmount = Math.max(0, currentLastY - targetLastY);

  function* traceFlow() {
    const items = traceLines.filter(i => i >= 2);
    const step = Math.max(0.08, 10 / Math.max(1, items.length));
    for (const idx of items) {
      yield* monolith.recolorTokens(idx, ['traceId'], TRACE_PINK, 0.18);
      yield* waitFor(step);
    }
  }

  yield* all(
    monolith.animateScrollY(scrollAmount, 10.5),
    traceFlow(),
  );

  if (useLine >= 0) {
    yield* all(
      monolith.highlightLines([[useLine, useLine]], 0.45),
      monolith.recolorTokens(useLine, ['traceId'], TRACE_PINK_SOFT, 0.22),
    );
    yield* monolith.recolorTokens(useLine, ['traceId'], TRACE_PINK, 0.22);
  }

  yield* waitFor(0.9);
  yield* monolith.disappear(Timing.normal);
});
