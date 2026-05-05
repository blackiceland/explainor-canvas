# Manticore / CodeLine refactoring plan

Контекст: текущая Manticore работает, после двух фиксов (placeholder-guard в
`typewriterNewTokens` и typewriter в `isAddOnly`-ветке) сцена
`codeWithActionsSceneRu` рендерится корректно. Но дизайн грязный, баги
прячутся в имплицитных инвариантах. Этот документ описывает поэтапный
рефакторинг с минимальным риском.

Файлы в зоне действия:
- `motion-canvas/src/core/code/components/Manticore.ts`
- `motion-canvas/src/core/code/components/CodeLine.ts`
- `motion-canvas/src/core/code/director/Medusa.ts`
- `motion-canvas/src/core/code/director/MorphProfiles.ts`
- `motion-canvas/src/core/code/validators/ManticoreRuntimeValidator.ts`

16 сцен зависят от Manticore через `Manticore.create` или `new Medusa`. Любая
правка должна сохранить их визуальный контракт.

---

## Что не так сейчас

### 1. Тройное представление видимости
Линия может быть скрыта три независимыми способами, и любой код, меняющий
одно, должен помнить про другие два:
- `cl.node.opacity` — фейд линии-контейнера.
- `cl.setAllTokensOpacity` — массовая установка per-token.
- `tokenData.ref().opacity` — per-char (через `hideTokensInstantly`).

Никаких ассертов, что инвариант «видимость = composite всех трёх» соблюдается.

### 2. Имплицитный инвариант prepare↔animate
В prepare-фазе:
```ts
if (opts.addStyle === 'typewriter') cl.hideTokensInstantly();
```
Создаёт инвариант «после prepare для add-line токены скрыты». Animate-фаза
обязана это знать и обязана восстановить через typewriter. Не выражено в
типах. Сломалось в `isAddOnly`-ветке — early-return пропустил восстановление,
все ADD-only morph'ы 2 недели тихо рендерились невидимо.

### 3. `isAddOnly` — спец-кейс под видом оптимизации
Ранний return существует, чтобы пропустить `buildMorphBlocks` и обычный цикл.
Но обычный цикл уже корректно обрабатывает pure-add diff (ветка `else` с
`cl.typewriter`). Спец-кейс не оптимизация, а параллельная имплементация —
которая разъехалась с основной.

### 4. Имена не совпадают со смыслом
- `vis.kept` — это «токены, которые надо ОСТАВИТЬ ВИДИМЫМИ во время
  mutate». Не «kept». Имя из `TokenDiff` перенесли в свойство со сдвинутой
  семантикой.
- `addStyle: 'typewriter'` управляет не только «как анимируется», но и
  «скрывать ли токены в prepare» — двойная роль одного флага. Добавь третий
  стиль — забудешь про prepare-сторону.

### 5. Лигатуры размазаны по 6 местам
Знание «N сиблингов, leading.text=full, остальные=''» захардкожено в:
- `CodeLine.build` (создание),
- `CodeLine.mutateInPlace` (keep + add),
- `CodeLine.typewriter`,
- `CodeLine.typewriterFrom`,
- `CodeLine.colorizeByRule` (group-логика),
- `Manticore.typewriterNewTokens`.

Каждое место должно знать инвариант — guard `if (text.length === 0) continue`
повторяется. Шестое место (`Manticore.typewriterNewTokens`) этот guard
пропустило в `881a30d` — баг.

### 6. mutateInPlace: `Txt.text` ≠ `tokenData.text`
Для kept-not-visible whitespace: `td.ref().text('')` стирает Txt, а
`tokenData.text` остаётся `' '`. Два источника правды о тексте.
`mapTokenDataToNewIndex` смотрит на `tokenData.text.length`, `applyRules` тоже
на `tokenData.text` — DOM расходится с моделью. Работает только потому что
typewriter сразу возвращает текст обратно в Txt.

### 7. Validator log-only
`validateRuntimeMorph` пишет `ANCHOR_NOT_VISIBLE` в `console.warn` каждый
второй morph и ничего не делает. Шум, маскирующий регрессии. Либо это
настоящая проблема (надо чинить и/или включить `strict: true`), либо ложный
сигнал (выкинуть правило).

---

## План рефакторинга — этапами, безопасно

### Этап 0 — регрессионные goldens (БЛОКИРУЕТ всё остальное)

В `motion-canvas/scripts/manticore-golden.mjs` уже есть скрипт. Расширить:
для каждой сцены через Manticore (16 файлов) снять PNG-скриншоты в опорных
точках (старт, после каждого morph'а, финал). Хранить в
`motion-canvas/db/manticore-goldens/<scene>/<frame>.png`.

CI/локальный таргет: `npm run test:manticore:golden` сравнивает текущий
рендер с эталоном. Без этого любой рефакторинг — игра с огнём, потому что
tsc не ловит token-level corruption, а юнит-тестов на визуал нет.

Затраты: 1 день. Без этого этапа дальнейшие шаги нельзя считать
безопасными.

---

### Этап 1 — дешёвые правки (низкий риск)

#### 1.1 Удалить `isAddOnly` early-return
В `Manticore.runAnimatePhase` убрать `if (isAddOnly) {...return}`. Общий цикл
`for (const block of state.blocks)` корректно обработает pure-add diff —
ветка `else` (`p.kind === 'add'`) запускает container-fade и `cl.typewriter`.

Риски:
- `buildMorphBlocks` для pure-add может объединить весь добавленный метод в
  один block. `ensureRangeVisible` попытается уместить блок в клип — если
  длина блока > clip, поведение скролла изменится.
- Возможно появятся новые `ANCHOR_NOT_VISIBLE` warnings (которые сейчас
  маскируются early-return'ом).

Митигация: запустить goldens, починить scroll-стратегию точечно.

#### 1.2 Переименования
- `vis.kept` → `vis.keepVisible` (внутреннее, чисто читаемость).
- Разделить `addStyle` на два понятия:
  - `addStyle: 'typewriter' | 'fade'` — анимация (внешний контракт).
  - В prepare-фазе вместо `if (addStyle === 'typewriter') hideTokensInstantly()`
    — явная функция `prepareAddLine(cl, addStyle)`, которая инкапсулирует
    решение о hide.

Риски: `addStyle` в `MorphOptions` экспортируется наружу. Поиск показал
использование только в `MorphProfiles.ts` и Манте — внешних потребителей
нет. Безопасно.

#### 1.3 Заглушить или починить `ANCHOR_NOT_VISIBLE`
Решить однозначно:
- Если правило истинное — добавить авто-scroll после morph'а в Medusa.
- Если ложное — удалить правило из `ManticoreRuntimeValidator`.

Текущее «log-and-continue» убрать.

Риски: если включим strict — упадут сцены. Делать строго после goldens.

---

### Этап 2 — синхронизация tokenData ↔ Txt (средний риск)

#### 2.1 Один источник правды для текста токена
В `CodeLine.mutateInPlace`: для kept-not-visible whitespace вместо
`td.ref().text('')` использовать `td.ref().opacity(0)`. `tokenData.text` и
`Txt.text` всегда синхронны.

`typewriterNewTokens` тогда не пишет текст с нуля — он только фейдит opacity
обратно к 1.

Риски:
- Изменится таймлайн: сейчас текст стирается мгновенно (нет flash), потом
  typewriter возвращает посимвольно. С opacity-подходом будет fade-out →
  fade-in или skip-in. Визуально другое — нужно сравнивать goldens.
- Возможно потребуется отдельный таймлайн «hide → reveal» для whitespace
  vs «type-from-empty» для add-токенов.

Митигация: пробовать на одной сцене (`codeWithActionsSceneRu`) первой,
сравнивать goldens, итерировать.

---

### Этап 3 — лигатуры как один Txt (высокий риск)

#### 3.1 Лигатура = один Txt-нод с per-char delay в typewriter
Сейчас `<=` — это два Txt-нода с x-смещением. Предлагается: один Txt с
`text='<='`, typewriter растит через `text(slice(0, c+1))`. Char-delay
работает естественно.

Что упрощается: исчезает понятие «placeholder», `tokensData[i+c]` нет,
`mapTokenDataToNewIndex` теряет особый случай, лигатуры в `colorizeByRule`
работают через обычный путь.

Что ломается:
- Per-char цвет — нельзя покрасить только `<` из `<=`. Сейчас никто так
  не делает, но это меняет контракт.
- Шрифты с лигатурами (Fira Code и т.п.) рендерят `<=` как один глиф —
  при typewriter `<` и потом `<=` глиф «прыгает» (ranges → ligature).
  Это и сейчас может быть проблемой — нужно проверить визуально.

Риски: высокие. Делать ПОСЛЕДНИМ и ТОЛЬКО если этап 2 показал, что миграция
безболезненная. Если goldens покажут визуальные различия — может оказаться
не стоит свеч.

---

### Этап 4 — opacity unification (отложить)

Свести три уровня opacity к одному per-token. Контейнер не трогать.
`setOpacity` / `dimLines` / `appear` переделать на per-token.

Это мегамиграция: задевает все 16 сцен через `dimLines`, `setOpacity`,
`appear`. Реальная польза — убрать класс багов вида «контейнер 1 × токен 0».
Но цена очень высокая.

Решение: НЕ ДЕЛАТЬ, пока не появится новый баг этого класса. Предыдущий
исправлен фиксом `isAddOnly` — возможно класс закрыт.

---

## Порядок исполнения

1. **Этап 0** — goldens. Без них дальше нельзя.
2. **Этап 1.1** — убрать `isAddOnly`. Самое дешёвое и явное улучшение.
3. **Этап 1.2** — переименования.
4. **Этап 1.3** — починить или выкинуть `ANCHOR_NOT_VISIBLE`.
5. **Этап 2** — синхронизация text. Поштучно по сценам, сравнивать goldens.
6. **Этап 3** — лигатуры. Решить fp/no-go ПОСЛЕ этапа 2.
7. **Этап 4** — opacity. Не делать без нового бага.

После каждого этапа — все goldens должны зелёные. Если красные — либо фикс,
либо обновление эталона с явным описанием почему изменился визуал.

---

## Что НЕ менять

- Публичный API `Manticore.create / mount / morphTo / colorize / appear /
  scrollTo / dimLines / setOpacity` — на нём держатся 16 сцен.
- `MorphOptions` поля, торчащие в `MorphProfiles` — стабильный контракт.
- `JavaClass` / `JavaModel` — это слой выше, не имеет отношения к Manticore.

---

## Текущее состояние (точка отсчёта)

Применены два фикса в `Manticore.ts`:
- `typewriterNewTokens`: добавлен `if (full.length === 0) continue` для
  placeholder'ов лигатур.
- `runAnimatePhase` `isAddOnly`-ветка: добавлен `cl.typewriter` /
  `cl.setAllTokensOpacity` параллельно с фейдом контейнера.

Сцена `codeWithActionsSceneRu` рендерится корректно (проверено puppeteer'ом
в опорных точках t30/t50/t60/t75). Сохраняется warning
`ANCHOR_NOT_VISIBLE: byte[] encode(` после `addMethod('encode')` —
кандидат для этапа 1.3.

---

## Дополнительная проблема: расхождение `cfg.y` и реальной позиции первой строки

Обнаружено при настройке `earnedAbstractionSceneEn` (Beat 1, две панели
side-by-side, 25 строк каждая, fontSize=22, lineHeight=35.6, height=0,
noClip=true).

### Симптом

Из чтения `Manticore.mount` следует формула:
```
container.y = cfg.y
startY (height=0 ветка) = -((N-1)/2) * lineHeight
первая строка в world space = cfg.y + startY
```

Для `N=25`, `lineHeight=35.6`, желаемой первой строки на `y=-510`
(30px от верха канваса при viewport 1920×1080):
```
cfg.y = -510 - startY = -510 + 427.2 = -82.8
```

На деле `cfg.y = -82.8` ставит первую строку примерно на `y=-260` —
**сдвиг ~250px вниз** относительно расчёта. Чтобы первая строка
оказалась у верха канваса, эмпирически потребовалось `cfg.y ≈ -350` —
это на ~270px более «отрицательно», чем формула.

То же расхождение, скорее всего, было всё это время — просто авторы
сцен empirically подбирали `y` под визуал, а не доверяли формуле.
В `prematureAbstractionResolutionSceneEn` стек считается через
`STACK_TOP = -(CH_HEIGHT + GAP + HP_HEIGHT) / 2` и `CH_Y = STACK_TOP +
CH_HEIGHT/2` — формально это центр панели, но на экране тоже не точно
там, где математика обещает.

### Кандидаты на источник сдвига

Не разбирался глубоко, поэтому гипотезы:

1. **`CodeCard.build()`** — внутри карточки может быть собственное
   `paddingY` или offset, который Manticore.mount не учитывает в `startY`.
2. **`getCodePaddingY(fontSize)`** — попадает в `cardHeight`
   (`contentHeight = N * lineHeight + paddingY * 2`) и в `clipHeight`,
   но в `startY` для height=0 ветки его нет. Возможный источник
   несоответствия: контент центрируется относительно `clipHeight`, а не
   `contentHeight`, и где-то это даёт сдвиг.
3. **Baseline vs visual top** — первая строка позиционируется по
   baseline'у на `lineY(0) = startY`, и визуальный верх символа
   находится выше baseline на ~`fontSize * 0.7` плюс leading. На 22pt
   это ~15px, не объясняет 250px.
4. **Transform на уровне `view`** — теоретически у `view` может быть
   свой scale/offset, но в `makeScene2D` ничего такого не задаётся.
5. **Editor-preview vs реальный рендер** — возможно, я считывал позицию
   с editor-preview'а, который показывает не строго viewport, и это
   не та позиция, что в финальном кадре. Не проверено.

### Что предлагается

**Сейчас не трогать.** Эмпирические значения `y` в существующих сценах
скорее всего тоже подобраны под этот сдвиг — массовая правка Manticore
сдвинет всё вверх и сломает 10+ сцен.

**Перед тем как чинить — провести аудит:**

1. Для 4-5 опорных сцен с явными `y`-вычислениями
   (`prematureAbstractionResolutionSceneEn`, `predictingFutureTakeSceneEn`,
   `robotArmCodeScene`, `problemsYouDontHaveStrategySceneEn`,
   `codeWithActionsSceneRu`) измерить:
   - расчётную позицию первой строки по формуле
     `cfg.y - ((N-1)/2) * lineHeight`
   - реальную позицию первой строки на канвасе (puppeteer-скрин,
     пиксельный замер)
2. Зафиксировать **константу сдвига** (если она постоянная)
   или **функцию от fontSize / lineHeight / N** (если зависит).
3. Решить:
   - **Вариант A** — починить `Manticore.mount` так, чтобы формула
     совпадала с реальностью. После этого rebase всех сцен:
     каждый явный `y` уменьшается на величину сдвига. Поломает все
     16 сцен сразу, нужно golden-snapshot тесты до и после.
   - **Вариант B** — оставить поведение, добавить публичный хелпер
     `manticoreFirstLineY(cfg)` или `manticoreCenterFromTop(targetTop, cfg)`,
     задокументировать сдвиг. Существующие сцены не трогаем, новые
     пользуются хелпером.

**Вариант B безопаснее.** Вариант A правильнее по архитектуре, но
требует goldens (этап 0 этого документа), которые ещё не сделаны.

### Текущий workaround

В `earnedAbstractionSceneEn`:
```ts
const LEFT_FULL_Y  = -350 - LINE_H / 2;
const RIGHT_FULL_Y = -350 - LINE_H / 2;
```
Подобрано глазами по скриншотам. Если поменяется `FONT_SIZE` или
число строк — формула снова поплывёт, надо будет пересчитывать
эмпирически.
