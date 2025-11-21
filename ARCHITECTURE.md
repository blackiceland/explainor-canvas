# 🏛️ Архитектура системы генерации анимированного контента

## 📋 Оглавление
1. [Обзор системы](#обзор-системы)
2. [Принципы проектирования](#принципы-проектирования)
3. [Эволюция архитектуры (4 фазы)](#эволюция-архитектуры)
4. [Текущая фаза: Component Library](#текущая-фаза-component-library)
5. [Структура проекта](#структура-проекта)
6. [Ключевые компоненты](#ключевые-компоненты)
7. [Правила разработки](#правила-разработки)

---

## 🎯 Обзор системы

### Бизнес-цель
Платформа для автоматической генерации анимированного технического контента (диаграммы, схемы архитектуры) для YouTube-роликов, курсов и технической документации.

### Целевая аудитория v1
- YouTube tech-блогеры (объясняют Kafka, PostgreSQL, Kubernetes)
- Авторы технических курсов
- Технические писатели (документация)

### Value Proposition
**"JSON → красивое анимированное видео"**
- Быстрее After Effects (минуты vs часы)
- Проще Manim (JSON vs Python-код)
- Красивее PowerPoint (профессиональная анимация)

---

## 🧭 Принципы проектирования

### 1. От простого к сложному
Не пытаемся сделать всё сразу. Развиваем систему итеративно, каждая фаза — рабочий продукт.

### 2. Архитектура снизу вверх
Сначала пишем компоненты для реальных сцен, затем извлекаем паттерны и обобщения.

### 3. Правило 70/30
- **70-90% времени:** 2D-сцены (ясность, читаемость, простой авто-лейаут)
- **10-30% времени:** 2.5D изометрия (визуальные акценты, глубина)

### 4. SOLID принципы
- **SRP:** Каждый компонент/класс = одна ответственность
- **OCP:** Открыт для расширения, закрыт для модификации
- **LSP:** Наследники взаимозаменяемы
- **ISP:** Интерфейсы под конкретные нужды
- **DIP:** Зависимость от абстракций, а не реализаций

### 5. Детерминизм превыше всего
Одинаковый JSON → одинаковое видео (на любой машине, в любое время). Критично для SaaS-рендера и кэширования.

---

## 🚀 Эволюция архитектуры

### Phase 1: Component Library (Недели 1-4) 🟢 **← МЫ ЗДЕСЬ**
**Цель:** Библиотека переиспользуемых компонентов для ручного создания сцен.

**Что делаем:**
- Пишем компоненты как классы (TypeScript)
- Создаём сцены вручную (kafkaScene.tsx, dbScene.tsx)
- Координаты элементов задаются явно (`x={100} y={50}`)
- Рендер локально через Motion Canvas UI

**Результат:** 
- 15-20 базовых компонентов
- 5-7 готовых сцен для видео
- Понимание паттернов и best practices

**Архитектурные решения:**
```typescript
// Компоненты = переиспользуемые классы
class KafkaTopic extends AnimatedComponent {
  constructor(props: TopicProps) { }
  appear(): Promise<void> { }
  highlight(color: string): Promise<void> { }
}

// Сцены = ручная композиция
export default makeScene2D(function* (view) {
  const topic = <KafkaTopic x={0} y={0} name="events" />;
  view.add(topic);
  yield* topic.appear();
});
```

---

### Phase 2: Scene Composition (Недели 5-8)
**Цель:** Композиция сцен из микро-шотов (shots).

**Что добавляем:**
- Shot-based архитектура (каждый шот = атомарное действие)
- TimelinePlayer (проигрыватель последовательности шотов)
- Базовые шоты (CameraPan, ComponentAppear, Highlight, TextOverlay)

**Результат:**
- Сцены не монолитные, а составные
- Переиспользование шотов между сценами
- Упрощение тестирования

**Архитектурные решения:**
```typescript
// Шоты = атомарные действия
abstract class Shot {
  abstract execute(view: View2D): Promise<void>;
}

class ComponentAppearShot extends Shot {
  constructor(private component: AnimatedComponent) { }
  async execute(view: View2D) {
    view.add(this.component);
    await this.component.appear();
  }
}

// Сцена = последовательность шотов
const timeline = new Timeline([
  new CameraPanShot([0, 0], [100, 0], 1.0),
  new ComponentAppearShot(topic),
  new HighlightShot(topic, '#FFD700'),
]);

yield* timeline.play();
```

---

### Phase 3: JSON-Driven (Недели 9-16)
**Цель:** Генерация сцен из JSON (без написания кода).

**Что добавляем:**
- Scene IR (Intermediate Representation) — декларативное описание сцены
- ElementFactory — создание компонентов из JSON
- GenericScene — универсальная сцена, читающая JSON
- Backend API (Spring Boot) — генерация JSON, валидация, версионирование

**Результат:**
- JSON → видео (без написания .tsx файлов)
- Валидация JSON (схема + миграции версий)
- Backend генерирует сцены динамически

**Архитектурные решения:**
```json
// Scene IR (JSON)
{
  "version": "1.0",
  "sceneId": "kafka-producer-consumer",
  "renderMode": "2d",
  "background": "#F5F5F5",
  "shots": [
    {
      "id": "shot-1",
      "type": "component-appear",
      "component": {
        "type": "KAFKA_TOPIC",
        "props": { "name": "events", "x": 0, "y": 0 }
      },
      "duration": 0.5
    }
  ]
}
```

```typescript
// GenericScene (универсальная сцена)
export default makeScene2D(function* (view) {
  const sceneData = yield fetchScene(sceneId);
  
  view.fill(sceneData.background);
  
  for (const shotDef of sceneData.shots) {
    const shot = ShotFactory.create(shotDef);
    yield* shot.execute(view);
  }
});
```

```java
// Backend (Spring Boot)
@RestController
@RequestMapping("/api/v1/scenes")
public class SceneController {
    
    @GetMapping("/{sceneId}")
    public SceneResponse getScene(@PathVariable String sceneId) {
        Scene scene = sceneFactory.create(sceneId);
        return sceneAssembler.toResponse(scene);
    }
}
```

---

### Phase 4: Production (Недели 17-24+)
**Цель:** Готовая SaaS-платформа с авто-лейаутом, рендер-фермой и UI.

**Что добавляем:**
- **Авто-лейаут:** ELKjs для автоматической раскладки графов
- **Рендер-ферма:** Асинхронный рендер (Redis + Workers + FFmpeg)
- **Scene Cache:** Кэширование по hash(IR + version + audio)
- **Web UI:** Загрузка JSON, предпросмотр, управление проектами
- **Audio Sync:** Маркеры для синхронизации с голосовой дорожкой
- **Themes:** Брендирование (цвета, шрифты, логотипы)

**Результат:**
- Полноценная SaaS-платформа
- JSON без координат (авто-лейаут)
- Масштабируемый рендер (десятки видео параллельно)
- Монетизация (freemium, тарифы по минутам рендера)

**Архитектурные решения:**
```typescript
// Авто-лейаут (ELKjs)
class LayoutEngine {
  async layout(scene: Scene): Promise<Scene> {
    const graph = this.toELKGraph(scene);
    const layouted = await elk.layout(graph);
    return this.applyCoordinates(scene, layouted);
  }
}
```

```
Рендер-ферма:
┌─────────┐   JSON    ┌──────────┐   Task   ┌────────────┐
│ User    │──────────>│ Backend  │─────────>│ Redis      │
└─────────┘           └──────────┘          │ (Queue)    │
                                            └────────────┘
                                                  │
                                                  ▼
                                          ┌────────────┐
                                          │ Worker 1-N │──> S3/MinIO
                                          │ (Node.js)  │    (MP4)
                                          └────────────┘
```

---

## 🟢 Текущая фаза: Component Library

### Цели текущей фазы
1. ✅ Создать 15-20 переиспользуемых компонентов
2. ✅ Выработать единый стиль (visual language)
3. ✅ Установить архитектурные паттерны
4. ✅ Получить 5-7 готовых сцен для видео

### Что НЕ делаем сейчас
- ❌ Backend API (пока не нужен)
- ❌ Авто-лейаут (координаты вручную)
- ❌ JSON-driven сцены (пишем .tsx)
- ❌ Физика в рантайме (только fake physics)

---

## 📁 Структура проекта

```
canvas/
├── src/main/java/com/dev/canvas/          # Backend (Spring Boot)
│   ├── domain/                            # Domain Layer (чистая логика)
│   │   ├── animation/                     # Анимации, сцены, элементы
│   │   └── layout/                        # Авто-лейаут (Phase 4)
│   ├── application/                       # Application Layer (use cases)
│   │   ├── controller/                    # REST API
│   │   ├── dto/                           # Data Transfer Objects
│   │   └── assembler/                     # Domain → DTO маппинг
│   └── infrastructure/                    # Infrastructure (DB, Redis, S3)
│
├── motion-canvas/                         # Frontend (Motion Canvas)
│   ├── src/
│   │   ├── components/                    # 🟢 Библиотека компонентов
│   │   │   ├── base/                      # Базовые (AnimatedComponent)
│   │   │   ├── primitives/                # Примитивы (Rect, Circle, Line)
│   │   │   ├── kafka/                     # Kafka компоненты
│   │   │   ├── db/                        # Database компоненты
│   │   │   ├── k8s/                       # Kubernetes компоненты
│   │   │   ├── network/                   # Network компоненты
│   │   │   └── algorithm/                 # Algorithm визуализации
│   │   │
│   │   ├── scenes/                        # 🟢 Готовые сцены
│   │   │   ├── kafka/
│   │   │   ├── db/
│   │   │   └── examples/
│   │   │
│   │   ├── shots/                         # Phase 2: Микро-шоты
│   │   ├── core/                          # Phase 3: GenericScene, Factory
│   │   ├── renderers/                     # 2D, Iso, Perspective
│   │   ├── layout/                        # Phase 4: LayoutEngine
│   │   └── services/                      # API client, audio sync
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── ARCHITECTURE.md                        # 🟢 Этот файл
├── ROADMAP.md                             # 🟢 План разработки
├── COMPONENT_GUIDE.md                     # 🟢 Гайд по компонентам
└── docker-compose.yml
```

---

## 🧩 Ключевые компоненты

### 1. AnimatedComponent (базовый класс)

**Назначение:** Базовый класс для всех анимированных компонентов.

```typescript
// motion-canvas/src/components/base/AnimatedComponent.ts
import {Node} from '@motion-canvas/2d';
import {Signal, SimpleSignal} from '@motion-canvas/core';

export interface AnimatedComponentProps {
  x?: number;
  y?: number;
  opacity?: number;
}

export abstract class AnimatedComponent extends Node {
  protected readonly xSignal: SimpleSignal<number>;
  protected readonly ySignal: SimpleSignal<number>;
  protected readonly opacitySignal: SimpleSignal<number>;
  
  constructor(props: AnimatedComponentProps) {
    super();
    this.xSignal = this.createSignal(props.x ?? 0);
    this.ySignal = this.createSignal(props.y ?? 0);
    this.opacitySignal = this.createSignal(props.opacity ?? 1);
    
    this.position([this.xSignal(), this.ySignal()]);
    this.opacity(this.opacitySignal());
  }
  
  // Стандартные анимации (должны быть у всех)
  abstract appear(duration?: number): Promise<void>;
  abstract disappear(duration?: number): Promise<void>;
  abstract highlight(color?: string, duration?: number): Promise<void>;
  
  // Утилиты
  protected createSignal<T>(value: T): SimpleSignal<T> {
    return new SimpleSignal(value);
  }
}
```

**Принципы:**
- ✅ Все компоненты наследуются от `AnimatedComponent`
- ✅ Обязательные методы: `appear()`, `disappear()`, `highlight()`
- ✅ Управление состоянием через Signal'ы (реактивность)

---

### 2. Renderer (абстракция рендеринга)

**Назначение:** Отделить логику компонента от способа рендеринга.

```typescript
// motion-canvas/src/renderers/Renderer.ts
export interface Renderer {
  drawRect(x: number, y: number, w: number, h: number, style: Style): void;
  drawCircle(x: number, y: number, r: number, style: Style): void;
  drawLine(x1: number, y1: number, x2: number, y2: number, style: Style): void;
  drawText(text: string, x: number, y: number, style: TextStyle): void;
  
  project(x: number, y: number, z: number): [number, number];
}

// Реализации:
class Renderer2D implements Renderer { } // Плоский 2D
class RendererIso implements Renderer { } // Изометрия (2.5D)
```

**Принципы:**
- ✅ Компоненты НЕ знают про Motion Canvas напрямую
- ✅ Рендерер можно подменить (2D → Iso → Perspective)
- ✅ Упрощает тестирование (mock renderer)

---

### 3. Style System (единый стиль)

**Назначение:** Консистентный визуальный язык.

```typescript
// motion-canvas/src/styles/Theme.ts
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    main: string;
    mono: string;
    sizes: { small: number; medium: number; large: number };
  };
  spacing: {
    xs: number; s: number; m: number; l: number; xl: number;
  };
  lineWidths: {
    thin: number; medium: number; thick: number;
  };
  shadows: {
    small: ShadowStyle;
    medium: ShadowStyle;
    large: ShadowStyle;
  };
  animations: {
    durations: { fast: number; medium: number; slow: number };
    easings: { easeIn: any; easeOut: any; easeInOut: any };
  };
}

// Использование:
const theme = DefaultTheme;
const topic = new KafkaTopic({
  fillColor: theme.colors.primary,
  strokeColor: theme.colors.text,
  lineWidth: theme.lineWidths.medium,
});
```

**Принципы:**
- ✅ Все стили через Theme (нет магических констант)
- ✅ Легко менять стиль всего проекта
- ✅ Поддержка брендирования (разные темы для клиентов)

---

### 4. Component Props (типизация)

**Назначение:** Строгая типизация пропсов компонентов.

```typescript
// motion-canvas/src/components/kafka/Topic.ts
export interface KafkaTopicProps extends AnimatedComponentProps {
  name: string;
  partitions?: number;
  replicationFactor?: number;
  fillColor?: string;
  strokeColor?: string;
  width?: number;
  height?: number;
}

export class KafkaTopic extends AnimatedComponent {
  private readonly nameSignal: SimpleSignal<string>;
  private readonly partitionsSignal: SimpleSignal<number>;
  
  constructor(props: KafkaTopicProps) {
    super(props);
    this.nameSignal = this.createSignal(props.name);
    this.partitionsSignal = this.createSignal(props.partitions ?? 3);
    
    // Рендеринг...
  }
  
  // Геттеры/сеттеры
  get name(): string { return this.nameSignal(); }
  set name(value: string) { this.nameSignal(value); }
}
```

**Принципы:**
- ✅ Все пропсы типизированы (TypeScript интерфейсы)
- ✅ Значения по умолчанию явно указаны
- ✅ Реактивность через Signal'ы

---

## 📜 Правила разработки

### Правило 1: Один компонент = один файл
```
✅ ХОРОШО:
motion-canvas/src/components/kafka/Topic.tsx
motion-canvas/src/components/kafka/Producer.tsx

❌ ПЛОХО:
motion-canvas/src/components/kafka/KafkaComponents.tsx (все в одном)
```

---

### Правило 2: Интерфейс Props всегда отдельно
```typescript
✅ ХОРОШО:
export interface TopicProps extends AnimatedComponentProps {
  name: string;
}
export class Topic extends AnimatedComponent { }

❌ ПЛОХО:
export class Topic extends AnimatedComponent {
  constructor(name: string, x: number, y: number) { } // анонимные параметры
}
```

---

### Правило 3: Никаких магических констант
```typescript
❌ ПЛОХО:
<Rect fill="#3B82F6" lineWidth={3} />

✅ ХОРОШО:
<Rect fill={theme.colors.primary} lineWidth={theme.lineWidths.medium} />
```

---

### Правило 4: Обязательные методы для всех компонентов
```typescript
class MyComponent extends AnimatedComponent {
  // ОБЯЗАТЕЛЬНО:
  appear(duration = 0.5) { /* анимация появления */ }
  disappear(duration = 0.3) { /* анимация исчезновения */ }
  highlight(color = '#FFD700', duration = 0.2) { /* подсветка */ }
}
```

---

### Правило 5: Композиция над наследованием
```typescript
❌ ПЛОХО: Глубокая иерархия
class Component { }
class AnimatedComponent extends Component { }
class PhysicsComponent extends AnimatedComponent { }
class KafkaTopic extends PhysicsComponent { }

✅ ХОРОШО: Композиция
class KafkaTopic extends AnimatedComponent {
  private shadow: ShadowRenderer;      // композиция
  private physics: PhysicsController;  // композиция
}
```

---

### Правило 6: Явные типы (никогда не используй `var`)
```typescript
❌ ПЛОХО:
var x = 100;
let items = [1, 2, 3];

✅ ХОРОШО:
const x: number = 100;
const items: number[] = [1, 2, 3];
```

---

### Правило 7: Методы 3-15 строк
```typescript
❌ ПЛОХО: Метод 50+ строк
appear() {
  // 50 строк кода...
}

✅ ХОРОШО: Разбиваем на подметоды
appear() {
  this.fadeIn();
  this.scaleUp();
  this.drawContent();
}

private fadeIn() { /* 5 строк */ }
private scaleUp() { /* 5 строк */ }
private drawContent() { /* 10 строк */ }
```

---

### Правило 8: Детерминизм (никакого `Math.random()`)
```typescript
❌ ПЛОХО: Недетерминированность
const offset = Math.random() * 10;

✅ ХОРОШО: Seeded RNG
const rng = new SeededRandom(42);
const offset = rng.next() * 10;
```

---

### Правило 9: Никаких комментариев (код должен быть self-documenting)
```typescript
❌ ПЛОХО:
// Создаём топик
const t = new Topic({ n: "events" });

✅ ХОРОШО:
const topic = new Topic({ name: "events" });
```

---

### Правило 10: Builder для сложных объектов
```typescript
✅ ХОРОШО:
const topic = KafkaTopic.builder()
  .name("events")
  .partitions(3)
  .replicationFactor(2)
  .style(theme.kafka.topicStyle)
  .build();
```

---

## 🎨 Визуальный язык (Design System)

### Палитра (2D vs 2.5D)

**2D (плоский):**
- Мягкие цвета (#F5F5F5 фон, #3B82F6 акцент)
- Тени: мягкие drop-shadow (blur: 10-20px)
- Линии: 2-3px
- Скругления: 8-16px

**2.5D (изометрия):**
- Контрастные цвета (#000 линии, #F5F5DC фон)
- Тени: проекционные на "пол"
- Линии: 2px (чёткие)
- Градации глубины (передняя грань светлее задней)

---

### Типографика
- **Основной шрифт:** Inter (sans-serif)
- **Моноширинный:** JetBrains Mono (код, логи)
- **Размеры:** 24px (мелкий текст), 36px (заголовки), 48px (hero)

---

### Анимации
- **Появление:** fade-in + scale-up (0.5s, easeOutCubic)
- **Исчезновение:** fade-out (0.3s, easeInCubic)
- **Подсветка:** glow + scale (0.2s, easeInOutCubic)
- **Переходы:** pan/zoom камеры (1-2s, easeInOutCubic)

---

## 🔄 Миграция между фазами

### Phase 1 → Phase 2 (Component → Shot)
```typescript
// Было (Phase 1):
export default makeScene2D(function* (view) {
  const topic = <Topic x={0} y={0} name="events" />;
  view.add(topic);
  yield* topic.appear();
});

// Стало (Phase 2):
export default makeScene2D(function* (view) {
  const topic = <Topic x={0} y={0} name="events" />;
  const timeline = new Timeline([
    new ComponentAppearShot(topic),
  ]);
  yield* timeline.play(view);
});
```

**Изменения:** Минимальные (добавили Timeline + Shot обёртки).

---

### Phase 2 → Phase 3 (Shot → JSON)
```typescript
// Было (Phase 2):
const timeline = new Timeline([
  new ComponentAppearShot(topic),
]);

// Стало (Phase 3):
const sceneData = yield fetchScene('kafka-topic');
const timeline = TimelineFactory.fromJSON(sceneData);
yield* timeline.play(view);
```

**Изменения:** Компоненты/шоты не меняются, добавляется Factory.

---

### Phase 3 → Phase 4 (JSON → Auto-layout)
```json
// Было (Phase 3): Ручные координаты
{
  "component": { "type": "TOPIC", "props": { "x": 100, "y": 50 } }
}

// Стало (Phase 4): Авто-лейаут
{
  "component": { "type": "TOPIC", "props": { "name": "events" } },
  "layout": { "algorithm": "layered" }
}
```

**Изменения:** Backend применяет ELKjs → добавляет координаты в JSON.

---

## 🧪 Тестирование

### Юнит-тесты (компоненты)
```typescript
describe('KafkaTopic', () => {
  it('should appear with fade-in animation', async () => {
    const topic = new KafkaTopic({ name: 'events' });
    expect(topic.opacity()).toBe(0);
    
    await topic.appear(0.5);
    
    expect(topic.opacity()).toBe(1);
  });
});
```

### Визуальные тесты (golden frames)
```typescript
// Рендерим сцену → сравниваем с эталонным PNG
const rendered = await renderScene('kafka-topic');
const golden = await loadGolden('kafka-topic.png');
expect(rendered).toMatchImage(golden, { threshold: 0.02 });
```

---

## 📊 Метрики качества

### Code Quality
- ✅ TypeScript strict mode (no `any`)
- ✅ ESLint + Prettier (автоформатирование)
- ✅ Тесты: 70%+ coverage (Phase 2+)

### Performance
- ✅ 60 FPS (preview)
- ✅ Рендер: <5 минут для 10-минутного видео (Phase 4)

### Архитектура
- ✅ Цикломатическая сложность: <10 (методы простые)
- ✅ Coupling: низкий (компоненты независимы)
- ✅ Cohesion: высокий (одна ответственность)

---

## 🚀 Заключение

Эта архитектура:
- ✅ **Эволюционная** (развивается итеративно)
- ✅ **Прагматичная** (начинаем просто, усложняем по мере роста)
- ✅ **Расширяемая** (легко добавлять новые компоненты)
- ✅ **Детерминированная** (одинаковый результат всегда)
- ✅ **SOLID** (следует всем принципам)

**Следующий шаг:** Читай `ROADMAP.md` для плана разработки.



