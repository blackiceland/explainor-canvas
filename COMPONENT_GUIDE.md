# 📦 Гайд по созданию компонентов

## 🎯 Назначение документа

Этот гайд — **единственный источник правды** о том, как писать компоненты в нашей системе.

**Для кого:**
- AI-ассистент (я), создающий компоненты по запросам
- Разработчики, добавляющие свои компоненты
- Ревьюеры кода

**Принцип:** Код должен быть самодокументируемым. Если нужны комментарии — значит, код плохой.

---

## 📋 Анатомия компонента

### Структура файла (обязательная)

```typescript
// 1. Импорты (сгруппированы)
import {Node, Rect, Line, Txt} from '@motion-canvas/2d';
import {
  createRef,
  createSignal,
  SimpleSignal,
  all,
  easeInOutCubic,
} from '@motion-canvas/core';

// 2. Базовый класс
import {AnimatedComponent, AnimatedComponentProps} from '../base/AnimatedComponent';

// 3. Тема
import {DefaultTheme} from '../../styles/DefaultTheme';

// 4. Интерфейс Props (ВСЕГДА отдельно)
export interface KafkaTopicProps extends AnimatedComponentProps {
  name: string;
  partitions?: number;
  replicationFactor?: number;
  width?: number;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
}

// 5. Класс компонента
export class KafkaTopic extends AnimatedComponent {
  // 5.1. Приватные поля (signals)
  private readonly nameSignal: SimpleSignal<string>;
  private readonly partitionsSignal: SimpleSignal<number>;
  
  // 5.2. Refs для дочерних нод
  private readonly containerRef = createRef<Rect>();
  private readonly labelRef = createRef<Txt>();
  
  // 5.3. Константы (размеры, цвета из theme)
  private readonly width: number;
  private readonly height: number;
  private readonly fillColor: string;
  private readonly strokeColor: string;
  
  // 5.4. Конструктор
  constructor(props: KafkaTopicProps) {
    super(props);
    
    this.nameSignal = this.createSignal(props.name);
    this.partitionsSignal = this.createSignal(props.partitions ?? 3);
    
    this.width = props.width ?? 200;
    this.height = props.height ?? 100;
    this.fillColor = props.fillColor ?? DefaultTheme.colors.primary;
    this.strokeColor = props.strokeColor ?? DefaultTheme.colors.text;
    
    this.buildUI();
  }
  
  // 5.5. Построение UI (приватный метод)
  private buildUI(): void {
    this.add(
      <Rect
        ref={this.containerRef}
        width={this.width}
        height={this.height}
        fill={this.fillColor}
        stroke={this.strokeColor}
        lineWidth={DefaultTheme.lineWidths.medium}
        radius={DefaultTheme.spacing.m}
        opacity={0}
      >
        <Txt
          ref={this.labelRef}
          text={() => this.nameSignal()}
          fill={DefaultTheme.colors.background}
          fontSize={DefaultTheme.fonts.sizes.medium}
          fontFamily={DefaultTheme.fonts.main}
        />
      </Rect>
    );
  }
  
  // 5.6. Обязательные методы (appear, disappear, highlight)
  async appear(duration: number = 0.5): Promise<void> {
    await all(
      this.containerRef().opacity(1, duration, easeInOutCubic),
      this.containerRef().scale(1, duration, easeInOutCubic).from(0.8),
    );
  }
  
  async disappear(duration: number = 0.3): Promise<void> {
    await this.containerRef().opacity(0, duration, easeInOutCubic);
  }
  
  async highlight(color: string = '#FFD700', duration: number = 0.2): Promise<void> {
    const originalStroke = this.strokeColor;
    await this.containerRef().stroke(color, duration, easeInOutCubic);
    await this.containerRef().stroke(originalStroke, duration, easeInOutCubic);
  }
  
  // 5.7. Геттеры/сеттеры (если нужна мутабельность)
  get name(): string {
    return this.nameSignal();
  }
  
  set name(value: string) {
    this.nameSignal(value);
  }
}
```

---

## ✅ Правила (ОБЯЗАТЕЛЬНЫЕ)

### Правило 1: Наследование от `AnimatedComponent`
```typescript
✅ ХОРОШО:
export class KafkaTopic extends AnimatedComponent { }

❌ ПЛОХО:
export class KafkaTopic extends Node { }  // напрямую от Motion Canvas
```

**Почему:** Единый интерфейс для всех компонентов (`appear()`, `disappear()`, `highlight()`).

---

### Правило 2: Props = отдельный интерфейс
```typescript
✅ ХОРОШО:
export interface KafkaTopicProps extends AnimatedComponentProps {
  name: string;
  partitions?: number;
}

export class KafkaTopic extends AnimatedComponent {
  constructor(props: KafkaTopicProps) { }
}

❌ ПЛОХО:
export class KafkaTopic extends AnimatedComponent {
  constructor(name: string, partitions: number) { }  // анонимные параметры
}
```

**Почему:** Типизация, расширяемость, совместимость с JSON.

---

### Правило 3: Обязательные значения по умолчанию
```typescript
✅ ХОРОШО:
partitions?: number;  // в интерфейсе
this.partitionsSignal = this.createSignal(props.partitions ?? 3);  // значение по умолчанию

❌ ПЛОХО:
partitions: number;  // обязательный параметр без умолчания
```

**Почему:** Упрощает использование (не нужно указывать все параметры).

---

### Правило 4: Никаких магических констант
```typescript
❌ ПЛОХО:
fill: '#3B82F6'
lineWidth: 3
fontSize: 36

✅ ХОРОШО:
fill: DefaultTheme.colors.primary
lineWidth: DefaultTheme.lineWidths.medium
fontSize: DefaultTheme.fonts.sizes.medium
```

**Почему:** Единый стиль, легко менять глобально.

---

### Правило 5: Реактивность через Signal'ы
```typescript
✅ ХОРОШО:
private readonly nameSignal: SimpleSignal<string>;

constructor(props: KafkaTopicProps) {
  this.nameSignal = this.createSignal(props.name);
}

<Txt text={() => this.nameSignal()} />  // реактивно

❌ ПЛОХО:
private name: string;

constructor(props: KafkaTopicProps) {
  this.name = props.name;
}

<Txt text={this.name} />  // не обновится при изменении
```

**Почему:** Motion Canvas требует реактивности для анимаций.

---

### Правило 6: Приватные методы для UI
```typescript
✅ ХОРОШО:
constructor(props: KafkaTopicProps) {
  super(props);
  this.initializeSignals(props);
  this.buildUI();
}

private initializeSignals(props: KafkaTopicProps): void { }
private buildUI(): void { }

❌ ПЛОХО:
constructor(props: KafkaTopicProps) {
  super(props);
  // 50 строк кода прямо в конструкторе
}
```

**Почему:** Читаемость, тестируемость.

---

### Правило 7: Явные типы (никогда `var`, избегай `let`)
```typescript
✅ ХОРОШО:
const width: number = 200;
const items: string[] = ['a', 'b', 'c'];

❌ ПЛОХО:
var width = 200;
let items = ['a', 'b', 'c'];
```

**Почему:** TypeScript strict mode, предсказуемость.

---

### Правило 8: Методы 3-15 строк
```typescript
❌ ПЛОХО:
async appear(duration: number = 0.5): Promise<void> {
  // 30 строк кода
}

✅ ХОРОШО:
async appear(duration: number = 0.5): Promise<void> {
  await this.fadeIn(duration);
  await this.scaleUp(duration);
}

private async fadeIn(duration: number): Promise<void> {
  // 5 строк
}

private async scaleUp(duration: number): Promise<void> {
  // 5 строк
}
```

**Почему:** SRP (Single Responsibility Principle), читаемость.

---

### Правило 9: Никаких комментариев
```typescript
❌ ПЛОХО:
// Создаём топик
const t = new Topic({ n: "events" });

// Делаем его видимым
await t.show();

✅ ХОРОШО:
const topic = new Topic({ name: "events" });
await topic.appear();
```

**Почему:** Код должен быть self-documenting. Комментарии устаревают.

---

### Правило 10: Builder для сложных Props (опционально)
```typescript
// Если Props имеет 5+ параметров — добавь builder
export class KafkaTopic {
  static builder(): KafkaTopicBuilder {
    return new KafkaTopicBuilder();
  }
}

class KafkaTopicBuilder {
  private props: Partial<KafkaTopicProps> = {};
  
  name(value: string): this {
    this.props.name = value;
    return this;
  }
  
  partitions(value: number): this {
    this.props.partitions = value;
    return this;
  }
  
  build(): KafkaTopic {
    return new KafkaTopic(this.props as KafkaTopicProps);
  }
}

// Использование:
const topic = KafkaTopic.builder()
  .name("events")
  .partitions(3)
  .build();
```

---

## 🎨 Визуальные паттерны

### Паттерн 1: Контейнер + Label
```typescript
// Большинство компонентов = прямоугольник + текст
this.add(
  <Rect ref={this.containerRef} {...}>
    <Txt ref={this.labelRef} text={...} />
  </Rect>
);
```

**Используется для:** Topic, Table, Pod, Server, Client

---

### Паттерн 2: Иконка + Label
```typescript
// Компонент с иконкой (круг, квадрат, SVG)
this.add(
  <Node>
    <Circle ref={this.iconRef} {...} />
    <Txt ref={this.labelRef} {...} />
  </Node>
);
```

**Используется для:** Producer, Consumer, Service

---

### Паттерн 3: Граф-элемент (Node + Edges)
```typescript
// Элемент, который соединяется стрелками
this.add(
  <Rect ref={this.bodyRef} {...}>
    <Node ref={this.portTopRef} x={0} y={-height/2} />
    <Node ref={this.portBottomRef} x={0} y={height/2} />
    <Node ref={this.portLeftRef} x={-width/2} y={0} />
    <Node ref={this.portRightRef} x={width/2} y={0} />
  </Rect>
);
```

**Используется для:** Topic, Table, Pod (когда нужны стрелки).

---

### Паттерн 4: Коллекция (массив элементов)
```typescript
// Компонент, содержащий массив дочерних элементов
this.add(
  <Layout direction="column" gap={10}>
    {this.items.map((item, i) => (
      <Rect key={`item-${i}`} {...} />
    ))}
  </Layout>
);
```

**Используется для:** Array, LinkedList, ConsumerGroup

---

## 🎬 Анимационные паттерны

### Анимация 1: Fade-in + Scale-up (появление)
```typescript
async appear(duration: number = 0.5): Promise<void> {
  await all(
    this.containerRef().opacity(1, duration, easeInOutCubic),
    this.containerRef().scale(1, duration, easeInOutCubic).from(0.8),
  );
}
```

**Когда использовать:** Для всех компонентов (стандартное появление).

---

### Анимация 2: Fade-out (исчезновение)
```typescript
async disappear(duration: number = 0.3): Promise<void> {
  await this.containerRef().opacity(0, duration, easeInOutCubic);
}
```

**Когда использовать:** Для всех компонентов (стандартное исчезновение).

---

### Анимация 3: Highlight (подсветка)
```typescript
async highlight(color: string = '#FFD700', duration: number = 0.2): Promise<void> {
  const original = this.strokeColor;
  await this.containerRef().stroke(color, duration, easeInOutCubic);
  await this.containerRef().stroke(original, duration, easeInOutCubic);
}
```

**Когда использовать:** Привлечь внимание к элементу.

---

### Анимация 4: Pulse (пульсация)
```typescript
async pulse(duration: number = 0.5): Promise<void> {
  await this.containerRef().scale(1.1, duration / 2, easeInOutCubic);
  await this.containerRef().scale(1.0, duration / 2, easeInOutCubic);
}
```

**Когда использовать:** "Сердцебиение" компонента (активность).

---

### Анимация 5: Shake (тряска)
```typescript
async shake(intensity: number = 10, duration: number = 0.3): Promise<void> {
  await this.containerRef().position.x(this.x + intensity, duration / 4);
  await this.containerRef().position.x(this.x - intensity, duration / 4);
  await this.containerRef().position.x(this.x + intensity, duration / 4);
  await this.containerRef().position.x(this.x, duration / 4);
}
```

**Когда использовать:** Ошибка, отклонение запроса.

---

## 🧩 Примеры компонентов (полные)

### Пример 1: Простой компонент (KafkaTopic)

См. раздел "Анатомия компонента" выше.

---

### Пример 2: Компонент с портами (Arrow-friendly)

```typescript
export interface GraphNodeProps extends AnimatedComponentProps {
  name: string;
  width?: number;
  height?: number;
}

export class GraphNode extends AnimatedComponent {
  private readonly containerRef = createRef<Rect>();
  
  public readonly portTop = createRef<Node>();
  public readonly portBottom = createRef<Node>();
  public readonly portLeft = createRef<Node>();
  public readonly portRight = createRef<Node>();
  
  constructor(props: GraphNodeProps) {
    super(props);
    
    const width = props.width ?? 150;
    const height = props.height ?? 80;
    
    this.add(
      <Node>
        <Rect
          ref={this.containerRef}
          width={width}
          height={height}
          fill={DefaultTheme.colors.primary}
          stroke={DefaultTheme.colors.text}
          lineWidth={DefaultTheme.lineWidths.medium}
          radius={DefaultTheme.spacing.m}
          opacity={0}
        >
          <Txt
            text={props.name}
            fill={DefaultTheme.colors.background}
            fontSize={DefaultTheme.fonts.sizes.medium}
          />
        </Rect>
        
        <Node ref={this.portTop} x={0} y={-height / 2} />
        <Node ref={this.portBottom} x={0} y={height / 2} />
        <Node ref={this.portLeft} x={-width / 2} y={0} />
        <Node ref={this.portRight} x={width / 2} y={0} />
      </Node>
    );
  }
  
  async appear(duration: number = 0.5): Promise<void> {
    await this.containerRef().opacity(1, duration, easeInOutCubic);
  }
  
  async disappear(duration: number = 0.3): Promise<void> {
    await this.containerRef().opacity(0, duration, easeInOutCubic);
  }
  
  async highlight(color: string = '#FFD700', duration: number = 0.2): Promise<void> {
    const original = this.containerRef().stroke();
    await this.containerRef().stroke(color, duration, easeInOutCubic);
    await this.containerRef().stroke(original, duration, easeInOutCubic);
  }
}
```

**Использование с Arrow:**
```typescript
const nodeA = <GraphNode name="A" x={-200} y={0} />;
const nodeB = <GraphNode name="B" x={200} y={0} />;

const arrow = <Arrow
  from={nodeA.portRight()}
  to={nodeB.portLeft()}
/>;
```

---

### Пример 3: Компонент-коллекция (Array)

```typescript
export interface ArrayComponentProps extends AnimatedComponentProps {
  values: number[];
  cellWidth?: number;
  cellHeight?: number;
  gap?: number;
}

export class ArrayComponent extends AnimatedComponent {
  private readonly cellRefs: Ref<Rect>[] = [];
  private readonly labelRefs: Ref<Txt>[] = [];
  
  constructor(props: ArrayComponentProps) {
    super(props);
    
    const cellWidth = props.cellWidth ?? 60;
    const cellHeight = props.cellHeight ?? 60;
    const gap = props.gap ?? 10;
    
    this.add(
      <Layout direction="row" gap={gap}>
        {props.values.map((value, i) => {
          const cellRef = createRef<Rect>();
          const labelRef = createRef<Txt>();
          this.cellRefs.push(cellRef);
          this.labelRefs.push(labelRef);
          
          return (
            <Rect
              key={`cell-${i}`}
              ref={cellRef}
              width={cellWidth}
              height={cellHeight}
              fill={DefaultTheme.colors.secondary}
              stroke={DefaultTheme.colors.text}
              lineWidth={DefaultTheme.lineWidths.thin}
              opacity={0}
            >
              <Txt
                ref={labelRef}
                text={value.toString()}
                fill={DefaultTheme.colors.background}
                fontSize={DefaultTheme.fonts.sizes.small}
              />
            </Rect>
          );
        })}
      </Layout>
    );
  }
  
  async appear(duration: number = 0.5): Promise<void> {
    const delay = duration / this.cellRefs.length;
    for (const cellRef of this.cellRefs) {
      cellRef().opacity(1, delay, easeInOutCubic);
      await waitFor(delay / 2);
    }
  }
  
  async disappear(duration: number = 0.3): Promise<void> {
    await all(
      ...this.cellRefs.map(ref => ref().opacity(0, duration, easeInOutCubic))
    );
  }
  
  async highlight(color: string = '#FFD700', duration: number = 0.2): Promise<void> {
    const originals = this.cellRefs.map(ref => ref().stroke());
    await all(
      ...this.cellRefs.map(ref => ref().stroke(color, duration, easeInOutCubic))
    );
    await all(
      ...this.cellRefs.map((ref, i) => ref().stroke(originals[i], duration, easeInOutCubic))
    );
  }
  
  async highlightCell(index: number, color: string = '#FFD700', duration: number = 0.2): Promise<void> {
    const cellRef = this.cellRefs[index];
    const original = cellRef().stroke();
    await cellRef().stroke(color, duration, easeInOutCubic);
    await cellRef().stroke(original, duration, easeInOutCubic);
  }
}
```

---

## 🚨 Анти-паттерны (ИЗБЕГАТЬ)

### Анти-паттерн 1: Прямое использование Motion Canvas нод
```typescript
❌ ПЛОХО:
export class MyComponent extends Rect {
  constructor() {
    super({ width: 100, height: 100 });
  }
}

✅ ХОРОШО:
export class MyComponent extends AnimatedComponent {
  constructor(props: MyComponentProps) {
    super(props);
    this.add(<Rect width={100} height={100} />);
  }
}
```

---

### Анти-паттерн 2: Мутация Props
```typescript
❌ ПЛОХО:
constructor(props: MyComponentProps) {
  super(props);
  props.name = "modified";  // мутация входных данных
}

✅ ХОРОШО:
constructor(props: MyComponentProps) {
  super(props);
  const name = props.name;  // копируем, не мутируем
}
```

---

### Анти-паттерн 3: Недетерминированность
```typescript
❌ ПЛОХО:
const offset = Math.random() * 10;  // каждый рендер — разный результат

✅ ХОРОШО:
const rng = new SeededRandom(42);  // детерминированный RNG
const offset = rng.next() * 10;
```

---

### Анти-паттерн 4: Глубокая иерархия наследования
```typescript
❌ ПЛОХО:
class Component extends Node { }
class AnimatedComponent extends Component { }
class PhysicsComponent extends AnimatedComponent { }
class KafkaTopic extends PhysicsComponent { }

✅ ХОРОШО:
class KafkaTopic extends AnimatedComponent {
  private physics: PhysicsController;  // композиция вместо наследования
}
```

---

### Анти-паттерн 5: Побочные эффекты в конструкторе
```typescript
❌ ПЛОХО:
constructor(props: MyComponentProps) {
  super(props);
  fetch('/api/data');  // сетевой запрос в конструкторе
  localStorage.setItem('key', 'value');  // запись в storage
}

✅ ХОРОШО:
constructor(props: MyComponentProps) {
  super(props);
  // только инициализация
}

async loadData(): Promise<void> {
  // асинхронная загрузка — в отдельном методе
}
```

---

## 🧪 Тестирование компонентов

### Юнит-тест (пример)

```typescript
import {describe, it, expect} from 'vitest';
import {KafkaTopic} from './KafkaTopic';

describe('KafkaTopic', () => {
  it('should create with default partitions', () => {
    const topic = new KafkaTopic({ name: 'events' });
    expect(topic.partitions).toBe(3);  // значение по умолчанию
  });
  
  it('should appear with fade-in animation', async () => {
    const topic = new KafkaTopic({ name: 'events' });
    expect(topic.opacity()).toBe(0);  // изначально невидим
    
    await topic.appear(0.5);
    
    expect(topic.opacity()).toBe(1);  // стал видимым
  });
  
  it('should update name reactively', () => {
    const topic = new KafkaTopic({ name: 'events' });
    expect(topic.name).toBe('events');
    
    topic.name = 'orders';
    
    expect(topic.name).toBe('orders');
  });
});
```

---

## 📊 Чек-лист (проверь перед коммитом)

### Структура
- [ ] Компонент наследуется от `AnimatedComponent`
- [ ] Props = отдельный интерфейс с `extends AnimatedComponentProps`
- [ ] Есть значения по умолчанию для опциональных Props
- [ ] Приватные поля (signals) объявлены в начале класса

### Стиль
- [ ] Никаких магических констант (всё через `DefaultTheme`)
- [ ] Явные типы (никогда `var`, избегай `let`)
- [ ] Методы 3-15 строк (иначе — разбить на подметоды)
- [ ] Никаких комментариев (код self-documenting)

### Анимации
- [ ] Реализованы `appear()`, `disappear()`, `highlight()`
- [ ] Длительность = параметр с умолчанием
- [ ] Easing = `easeInOutCubic` (или обоснованный выбор)

### Реактивность
- [ ] Мутабельные свойства = Signal'ы
- [ ] Текст/числа в UI = `() => signal()` (функция, а не значение)

### Детерминизм
- [ ] Никакого `Math.random()` (только `SeededRandom`)
- [ ] Никаких `Date.now()`, `performance.now()` (только через параметры)

### Читаемость
- [ ] Имена переменных семантичные (`topic`, а не `t`)
- [ ] Методы с глаголами (`appear()`, а не `show()`)
- [ ] Константы с префиксом типа (`const width: number`, а не `const w`)

---

## 🎯 Заключение

**Этот гайд — живой документ.**

Если ты (AI или человек) создаёшь компонент и видишь, что:
- Что-то не покрыто гайдом
- Правило устарело
- Нашёл лучший паттерн

**→ Обнови этот файл!**

**Принцип:** Гайд должен отражать реальный код, а не идеальные фантазии.



