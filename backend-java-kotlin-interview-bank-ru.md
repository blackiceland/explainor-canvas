# Банк вопросов для backend-собеседований Java/Kotlin — Strong Middle / Senior

Практический корпус для реальных технических интервью (продуктовые компании, банки, финтех, enterprise, highload).
Упор на вопросы, которые отделяют инженера от того, кто знает только синтаксис.

**Уровни:** `J` junior-проверка · `M` middle · `SM` strong middle · `S` senior
Каждый пункт: вопрос, что реально проверяют, типичная ловушка и follow-up, который чаще всего и решает исход.

-----

## 1. Java Core

**[J] `==` против `equals()` и контракт `equals`/`hashCode`.**
*Проверяют:* основы + контракт. *Ловушка:* забыть, что нарушение `hashCode` молча ломает `HashMap`/`HashSet`. *Follow-up:* что будет, если `hashCode` константа для всех объектов? (деградация до O(n), но корректность сохраняется.)

**[M] Почему `String` иммутабельна и что это даёт JVM?**
*Проверяют:* string pool, потокобезопасность, безопасные ключи map, security. *Follow-up:* что делает `intern()` и когда он вредит? (давление на heap, GC.)

**[M] `final` на поле / переменной / методе / классе — что гарантирует каждый случай?**
*Ловушка:* считать, что `final` делает коллекцию неизменяемой (final только ссылка). *Follow-up:* связь `final`-поля с моделью памяти (безопасная публикация после конструктора).

**[SM] Разница `==` для boxed `Integer` со значением 100 и 1000.**
*Проверяют:* Integer cache (-128..127), подводные камни autoboxing. *Ловушка:* сравнивать boxed-числа через `==`.

**[M] Передача по значению или по ссылке в Java.**
*Проверяют:* в Java всегда передача по значению (ссылки передаются по значению). *Follow-up:* может ли метод изменить объект вызывающего? поменять две ссылки местами?

**[SM] `String` против `StringBuilder` против `StringBuffer`.**
*Follow-up:* что в однопоточном горячем цикле и почему? оптимизации компилятора для `+`?

**[SM] Marker interface против аннотации — когда маркерный интерфейс всё ещё уместен?**
*Проверяют:* гарантии на уровне типа, `instanceof`. *Follow-up:* критика `Serializable` как маркера.

**[S] Как работает `Object.clone()` и почему его считают сломанным?**
*Проверяют:* shallow/deep copy, изъяны дизайна `Cloneable`. *Follow-up:* предпочтительные способы копирования (copy-конструктор, фабрика, builder).

**[S] Семантика `record` — equals/hashCode/toString, иммутабельность, ограничения.**
*Follow-up:* может ли record иметь дополнительное состояние? валидация в compact-конструкторе? когда record не подходит.

-----

## 2. Collections

**[M] `ArrayList` против `LinkedList` — когда `LinkedList` реально лучше?**
*Ловушка:* «LinkedList быстрее на вставках» — верно только если итератор уже стоит на позиции; вставка по индексу всё равно O(n) обход + плохая cache-локальность. *Follow-up:* почему `ArrayList` почти всегда дефолт?

**[M] Как устроен `HashMap` внутри (бакеты, load factor, resize)?**
*Follow-up:* что изменилось в Java 8 (treeification при 8 элементах / таблица ≥64)? *Ловушка:* не знать, что resize это O(n) с рехешем.

**[SM] Что сломается, если изменить ключ после `put` в `HashMap`?**
*Проверяют:* зависимость от hashCode. *Follow-up:* правило — ключи иммутабельны.

**[SM] `ConcurrentModificationException` — что вызывает и как избежать.**
*Проверяют:* fail-fast итераторы, modCount. *Ловушка:* думать, что это только про потоки (remove в for-each в одном потоке тоже триггерит). *Follow-up:* `Iterator.remove`, `removeIf`, copy-on-write.

**[SM] `HashMap` / `LinkedHashMap` / `TreeMap` — сложность и порядок.**
*Follow-up:* реализовать LRU-кэш на `LinkedHashMap` (accessOrder + removeEldestEntry).

**[S] Почему `HashMap` не потокобезопасен и что именно ломается при конкуренции?**
*Проверяют:* потерянные обновления, бесконечный цикл при resize до Java 8, видимость. *Follow-up:* как `ConcurrentHashMap` достигает конкурентности без блокировки всей map? (CAS на бакетах + synchronized на bin.)

**[S] `ConcurrentHashMap` — точен ли `size()`? атомарны ли составные операции?**
*Ловушка:* `if (!map.containsKey) map.put` — это гонка. *Follow-up:* `computeIfAbsent`, `merge`, атомарная семантика.

**[SM] Подводные камни `Arrays.asList()`.**
*Ловушка:* фиксированный размер, обёртка над массивом, `add` бросает; примитивы боксятся странно. *Follow-up:* варианты иммутабельного списка (`List.of` vs `Collections.unmodifiableList` — в чём разница?).

-----

## 3. Generics

**[M] Что такое type erasure и чего это стоит в рантайме?**
*Проверяют:* нельзя `new T[]`, `instanceof T`, нет reified-типов. *Follow-up:* как сохранить инфу о типе? (`Class<T>` token, super type tokens.)

**[SM] PECS — `? extends` против `? super` на реальном примере.**
*Проверяют:* интуиция вариантности. *Follow-up:* почему нельзя добавить в `List<? extends Number>`?

**[SM] Можно ли перегрузить методы, отличающиеся только generic-типом? Почему?**
*Проверяют:* erasure → одинаковая сигнатура → не скомпилируется.

**[S] Ограниченные type-параметры и рекурсивные generics (`T extends Comparable<T>`).**
*Follow-up:* спроектировать fluent builder, возвращающий конкретный подтип (CRTP).

-----

## 4. Functional programming, lambdas, streams

**[M] Lambda против анонимного класса — семантика захвата и `this`.**
*Ловушка:* `this` в лямбде это внешний инстанс, не сама лямбда. *Follow-up:* захват effectively-final — зачем ограничение?

**[M] Intermediate против terminal операций; ленивость.**
*Проверяют:* ничего не выполняется до terminal-операции. *Follow-up:* можно ли переиспользовать stream? (нет.)

**[SM] Когда parallel stream реально помогает, а когда вредит?**
*Ловушка:* параллелить мелкую/IO-bound/упорядоченную работу; голодание общего ForkJoinPool. *Follow-up:* что хорошо делится? (большая CPU-bound задача на splittable-источнике типа массива.)

**[SM] `map` против `flatMap` — на backend-примере.**
*Follow-up:* цепочка `Optional.flatMap`; расплющивание `List<List<T>>`.

**[SM] `Collectors.toMap` с дубликатами ключей — что произойдёт?**
*Ловушка:* бросает `IllegalStateException`; нужна merge-функция. *Follow-up:* `groupingBy` + downstream-коллекторы.

**[S] Stateful-лямбды в стримах и гарантии порядка.**
*Проверяют:* побочные эффекты, `forEach` vs `forEachOrdered`, non-interference. *Ловушка:* мутировать внешнее состояние из parallel stream.

**[SM] `Optional` — корректное использование и анти-паттерны.**
*Ловушка:* `Optional` в полях/параметрах, `isPresent()+get()`, `Optional` от коллекции. *Follow-up:* `orElse` vs `orElseGet` (eager vs lazy) — классическая ловушка.

-----

## 5. Exceptions

**[M] Checked против unchecked — и спор о дизайне.**
*Follow-up:* почему Kotlin отказался от checked-исключений? согласен ли ты?

**[SM] `try-with-resources` — порядок закрытия, suppressed-исключения.**
*Проверяют:* `AutoCloseable`, закрытие в обратном порядке, `getSuppressed()`.

**[SM] Чем плох широкий `catch (Exception)` / `Throwable`?**
*Ловушка:* проглатывание `InterruptedException`, ловля `Error`. *Follow-up:* правильная обработка `InterruptedException` (восстановить флаг).

**[S] Обработка исключений через границы потоков (executors, futures).**
*Проверяют:* исключения в `Runnable` исчезают; `Future.get` оборачивает в `ExecutionException`; exceptional completion у `CompletableFuture`.

**[SM] `finally` с `return` — что вернёт метод?**
*Ловушка:* `return` в `finally` перекрывает; утечки ресурсов.

-----

## 6. Multithreading и concurrency

**[M] `synchronized` — что именно блокируется и реентерабельность.**
*Follow-up:* synchronized-метод vs блок; блокировка на `this` vs приватный объект-замок (почему второе).

**[SM] `volatile` — что гарантирует и что НЕ гарантирует.**
*Проверяют:* видимость + упорядочивание, НЕ атомарность составных операций. *Ловушка:* `volatile counter++`. *Follow-up:* когда volatile достаточно? (один писатель / флаг.)

**[SM] Happens-before — определи и приведи три «ребра».**
*Проверяют:* program order, монитор, volatile, start/join потока, final-поля. *Follow-up:* double-checked locking — почему `volatile` обязателен.

**[SM] Корректное использование `wait/notify`.**
*Ловушка:* `if` вместо `while` (spurious wakeups), notify vs notifyAll, нужно держать монитор. *Follow-up:* переписать на `Lock`/`Condition`.

**[SM] `ExecutorService` — взаимодействие core/max pool, очереди и rejection policy.**
*Ловушка:* безграничная очередь → maxPoolSize никогда не достигается; `Executors.newFixedThreadPool` прячет безграничную очередь → риск OOM. *Follow-up:* размер пула для CPU-bound и IO-bound.

**[S] `CompletableFuture` — `thenApply` vs `thenApplyAsync`, какой поток что выполняет?**
*Follow-up:* объединить N async-вызовов, пробросить таймауты, обработать одну ошибку без падения всех.

**[S] `ThreadLocal` — легитимные применения и риск утечки.**
*Ловушка:* утечки в пулах потоков (значение живёт дольше запроса); обязателен `remove()`. *Follow-up:* связь с `@RequestScope`, MDC для логов, влияние virtual threads.

**[S] AtomicX / CAS — как работает `compareAndSet` и проблема ABA.**
*Follow-up:* `AtomicStampedReference`; `LongAdder` vs `AtomicLong` под контеншеном.

**[S] Deadlock, livelock, starvation — причина и предотвращение.**
*Проверяют:* упорядочивание блокировок, tryLock с таймаутом. *Follow-up:* как обнаружить deadlock в проде? (thread dump, `jstack`, заблокированные потоки.)

**[S] JMM: почему два потока могут видеть разные значения non-volatile поля?**
*Проверяют:* кэши, переупорядочивание, отсутствие happens-before. Senior-дифференциатор.

**[SM] `CountDownLatch` / `CyclicBarrier` / `Semaphore` / `Phaser` — выбрать нужное.**

**[S] Virtual threads (Project Loom) — какую проблему решают и что ломается?**
*Проверяют:* дешёвый блокирующий IO, carrier threads, pinning на `synchronized`/native. *Ловушка:* пулить virtual threads; тяжёлое использование `ThreadLocal`. *Follow-up:* virtual threads vs реактивщина — компромиссы.

-----

## 7. JVM, память, GC, classloading, профилирование

**[M] Heap vs stack — что где живёт; что такое metaspace?**
*Follow-up:* причины `StackOverflowError` vs `OutOfMemoryError`.

**[SM] GC roots и достижимость — что держит объект живым?**
*Ловушка:* «нет ссылок = сразу собран» (только eligible). *Follow-up:* частые источники утечек (static-коллекции, listeners, ThreadLocal, ClassLoader-утечки в app-серверах).

**[S] Поколенческий GC — young/old, minor vs major/full GC, зачем поколения.**
*Follow-up:* G1 vs ZGC vs Parallel — когда что? цели по паузам.

**[S] В проде частые длинные паузы GC. Как диагностировать?**
*Скелет:* GC-логи → причина паузы (allocation rate, promotion, фрагментация, humongous-объекты в G1) → heap dump на утечки → тюнинг или фикс аллокаций. *Follow-up:* отличие высокого allocation rate от утечки памяти.

**[S] Strong/soft/weak/phantom-ссылки — реальное применение каждой.**
*Follow-up:* почему кэши на `WeakHashMap` часто разочаровывают.

**[SM] Что такое escape analysis и какие оптимизации он даёт?**
*Проверяют:* scalar replacement, аллокация на стеке, lock elision.

**[S] Classloading: модель parent-delegation и когда она кусается.**
*Follow-up:* `ClassNotFoundException` vs `NoClassDefFoundError`; classloader-утечки; почему два класса с одним FQN могут быть не равны.

**[SM] Как профилировать всплеск CPU vs проблему с памятью в проде?**
*Проверяют:* async-profiler/JFR, flame graphs, heap dump + MAT, `jstack`, `jcmd`. *Ловушка:* лезть отладчиком вместо sampling-профайлера.

-----

## 8. Kotlin Core (для backend Java-разработчика)

**[M] `val` vs `var` vs `const val`; compile-time константы.**
*Ловушка:* `val` это read-only ссылка, не иммутабельный объект.

**[M] Null-safety: `?`, `?.`, `?:`, `!!` и platform types.**
*Ловушка:* `!!` повсюду; platform types `T!` из Java молча обходят null-проверки. *Follow-up:* как взаимодействуют Java-аннотации `@Nullable`/`@NotNull`?

**[SM] `data class` — что генерит и его ограничения.**
*Ловушка:* `equals`/`hashCode` только по свойствам конструктора; `copy` поверхностный; ограничения наследования. *Follow-up:* data class как JPA-entity — почему это плохо (equals/hashCode + прокси + мутабельность).

**[SM] `sealed class`/`sealed interface` — что даёт сверх enum?**
*Проверяют:* исчерпывающий `when`, состояние с данными. *Follow-up:* моделирование result/доменного state machine.

**[SM] `object`, `companion object` и как они мапятся в Java/static.**
*Follow-up:* `@JvmStatic`, `@JvmField`; вызов членов companion из Java.

**[SM] Extension-функции — как резолвятся (статическая диспетчеризация)?**
*Ловушка:* считать их полиморфными; резолв по объявленному типу, не по рантайм-типу. *Follow-up:* приоритет extension vs member.

**[SM] `let`/`run`/`apply`/`also`/`with` — receiver vs аргумент, возвращаемое значение; выбрать верно.**
*Ловушка:* использовать их ради «идиоматичности»; вложенность, бьющая по читаемости.

**[S] `inline`/`value class` — что инлайнится и зачем.**
*Проверяют:* избегание аллокации, типобезопасные обёртки (`UserId`), правила боксинга при generic/nullable использовании. *Follow-up:* `reified` type-параметры — что дают и почему требуется inline.

**[SM] Вариантность: `in`/`out`/`where`; declaration-site vs use-site.**
*Follow-up:* сопоставить вариантность Kotlin с Java-wildcards.

**[M] Smart cast — когда НЕ работает?**
*Ловушка:* мутабельный `var` / свойства с кастомным геттером / межмодульность — smart cast не срабатывает.

-----

## 9. Kotlin Coroutines

**[M] Корутина против потока — что реально дешевле?**
*Проверяют:* приостановка вместо блокировки, много корутин на немногих потоках.

**[SM] `suspend` — что делает компилятор (continuations/CPS)?**
*Follow-up:* почему suspend-функцию можно звать только из корутины или другой suspend-функции.

**[SM] Structured concurrency — `coroutineScope` vs `supervisorScope`.**
*Проверяют:* падение ребёнка отменяет соседей vs изолированное падение. *Ловушка:* утечки `GlobalScope`. *Follow-up:* распространение отмены, иерархия `Job`.

**[SM] Dispatchers: `Default` / `IO` / `Main` / `Unconfined`.**
*Ловушка:* CPU-работа на `IO`, блокирующий вызов на `Default`. *Follow-up:* `withContext` для переключения; почему блокировать поток диспетчера плохо.

**[S] Кооперативная отмена — почему корутина «не отменяется».**
*Проверяют:* отмена кооперативна; нужен suspending/`isActive`/`ensureActive`; `try/finally` + `withContext(NonCancellable)` для очистки. *Ловушка:* проглатывать `CancellationException`.

**[S] `async`/`await` vs `launch`; разница в проброске исключений.**
*Ловушка:* исключение в `async` всплывает на `await`; в `launch` сразу идёт в scope.

**[S] Корутины со Spring (WebFlux / suspend-контроллеры в MVC).**
*Follow-up:* смешивание блокирующего JDBC с корутинами; где R2DBC; транзакционный контекст через приостановку.

-----

## 10. Java / Kotlin interoperability

**[SM] Platform types — главный interop-капкан.**
*Проверяют:* `T!` обходит null-safety; NPE протекают из Java. *Follow-up:* аннотировать Java или оборачивать на границе.

**[SM] Вызов Kotlin из Java: `@JvmStatic`, `@JvmOverloads`, `@JvmName`, `@JvmField`.**
*Follow-up:* default-аргументы не существуют для Java без `@JvmOverloads`.

**[M] Checked-исключения: Kotlin их не декларирует — что ломается у Java-вызывающих?**
*Ловушка:* Java-вызывающий не может `catch` checked-исключение, которое «бросает» Kotlin; нужен `@Throws`.

**[SM] `Unit` vs `void`, `Nothing`, nullable-примитивы через границу.**

-----

## 11. Spring Framework / DI / IoC

**[M] Constructor / field / setter injection — что и почему.**
*Проверяют:* конструктор для обязательных + иммутабельность + тестируемость; field injection вредит тестам и прячет зависимости. *Ловушка:* field injection через `@Autowired` как дефолт.

**[SM] Scope бинов: singleton, prototype, request, session.**
*Ловушка:* инжект prototype/request-бина в singleton (резолвится один раз). *Follow-up:* фикс через `ObjectProvider`, `@Lookup`, scoped-proxy.

**[SM] Жизненный цикл бина и `@PostConstruct`/`InitializingBean`/`@Bean(initMethod)`.**
*Follow-up:* порядок `BeanPostProcessor`, `BeanFactoryPostProcessor`.

**[S] Как реально работает `@Transactional`? (механика прокси)**
*Проверяют:* AOP-прокси, поэтому self-invocation его обходит; только public-методы; runtime-исключения откатывают по умолчанию, checked — нет. *Ловушка:* вызов `@Transactional`-метода из того же класса. *Follow-up:* `rollbackFor`, propagation, почему аннотация на private-методе ничего не делает.

**[S] Проблема self-invocation у `@Async`/`@Cacheable`/`@Transactional` — общий корень.**
*Follow-up:* фиксы (self-inject, отдельный бин, AspectJ-weaving).

**[SM] Циклическая зависимость — как Spring её решает и когда не может.**
*Проверяют:* setter/field резолвится через раннюю ссылку; цикл через конструктор падает. *Follow-up:* циклическая зависимость — это запах дизайна?

**[SM] `@Qualifier` / `@Primary` / `@Profile` — разрешение неоднозначности.**

**[S] Что делает auto-configuration Spring Boot и как отлаживать неверный бин?**
*Проверяют:* `@Conditional*`, `AutoConfiguration.imports`, `--debug` condition report, `@ConditionalOnMissingBean`. *Follow-up:* переопределить авто-сконфигурированный бин.

-----

## 12. Spring Boot

**[M] Starters и что тянет `spring-boot-starter-web`.**

**[SM] Приоритет конфигурации (properties, yaml, env, args, профили).**
*Follow-up:* `@ConfigurationProperties` vs `@Value`; relaxed binding; валидация.

**[SM] Actuator — какие эндпоинты важны в проде и как их защитить.**
*Проверяют:* health, metrics, prometheus, info; конфиг exposure; liveness vs readiness.

**[S] Graceful shutdown — что делает Spring Boot и зачем это в K8s.**
*Follow-up:* дренаж in-flight запросов, `server.shutdown=graceful`, preStop-хук, дренаж соединений.

**[SM] Как выносить секреты и чего НЕ делать?**
*Ловушка:* секреты в `application.yml` / git. *Follow-up:* Vault, K8s secrets, инъекция через env.

-----

## 13. Spring MVC / REST / API design

**[M] `@RestController` vs `@Controller`; `@RequestBody`/`@ResponseBody`.**

**[SM] Идемпотентность в REST — какие методы и как сделать POST идемпотентным?**
*Проверяют:* GET/PUT/DELETE идемпотентны; POST нет. *Follow-up:* idempotency key + dedup-хранилище — пример с платежами/заказами.

**[SM] Пагинация для большого датасета.**
*Ловушка:* offset-пагинация на глубоких страницах (медленно, нестабильно при записи). *Follow-up:* keyset/cursor-пагинация.

**[SM] Стратегии версионирования API и компромиссы.**
*Проверяют:* URL vs header vs media-type; правила обратной совместимости.

**[SM] Коды: 400 / 401 / 403 / 404 / 409 / 422 / 429 / 503 — дай сценарий каждому.**
*Ловушка:* 200 с телом ошибки; 500 на валидации.

**[S] Как обрабатывать частичный отказ в составном эндпоинте, который зовёт 3 сервиса?**
*Follow-up:* таймауты, fallback’и, частичные данные vs падение целиком.

**[SM] Bean Validation (`@Valid`, группы) и централизованная обработка ошибок (`@ControllerAdvice`).**

**[S] Content negotiation, HATEOAS и когда REST не подходит (vs gRPC/GraphQL).**

-----

## 14. Spring Security

**[M] Аутентификация vs авторизация; ментальная модель filter chain.**

**[SM] JWT — компромиссы stateless-аутентификации.**
*Ловушка:* нельзя отозвать JWT до истечения; чувствительные данные в payload; `alg:none`. *Follow-up:* refresh-токены, короткий TTL + revocation list, где хранить токен (httpOnly cookie vs localStorage и XSS).

**[SM] Session-based vs token-based — выбрать под систему.**
*Follow-up:* актуальность CSRF для cookie vs bearer.

**[S] Method-level security (`@PreAuthorize`) — как форсится и как обходится?**
*Проверяют:* снова AOP-прокси (self-invocation). *Follow-up:* SpEL, доступ к principal.

**[SM] Правильное хранение паролей.**
*Проверяют:* bcrypt/argon2, соль, work factor; никогда MD5/SHA-1, никогда plaintext.

**[S] OAuth2/OIDC: resource server vs client vs authorization server; scope vs role?**

-----

## 15. Транзакции

**[SM] ACID — объясни каждую букву на примере отказа.**

**[S] Уровни изоляции и аномалии, которые они предотвращают (dirty/non-repeatable/phantom).**
*Follow-up:* что по умолчанию в PostgreSQL? (Read Committed.) что даёт `REPEATABLE READ` в PG (снапшот)?

**[S] Propagation у `@Transactional` — `REQUIRED` vs `REQUIRES_NEW` vs `NESTED`.**
*Ловушка:* ждать, что внутренний `REQUIRED` закоммитится независимо; он присоединяется к внешней. *Follow-up:* лог/аудит, который должен пережить откат → `REQUIRES_NEW`.

**[S] Оптимистичные vs пессимистичные блокировки — когда что и режимы отказа.**
*Проверяют:* `@Version` + ретрай на `OptimisticLockException`; `SELECT FOR UPDATE` + риск deadlock/timeout.

**[S] Транзакция + внешний вызов (email/Kafka) внутри `@Transactional` — что не так?**
*Скелет:* побочные эффекты нельзя откатить; вызов может пройти, а транзакция откатиться, или коммит прошёл, а вызов упал. *Follow-up:* transactional outbox, `@TransactionalEventListener(AFTER_COMMIT)`.

**[S] Долгая транзакция, держащая соединение с БД — влияние на прод.**
*Проверяют:* истощение пула соединений, контеншен блокировок, bloat. *Follow-up:* держать транзакции короткими; IO вне транзакции.

**[SM] Read-only транзакции — что дают?**
*Проверяют:* подсказка JPA (нет dirty checking/flush), оптимизации БД, маршрутизация на реплики.

-----

## 16. Hibernate / JPA

**[SM] Проблема N+1 select — обнаружить и починить.**
*Проверяют:* ленивые коллекции в цикле. *Follow-up:* `JOIN FETCH`, `@EntityGraph`, batch size; почему `JOIN FETCH` + пагинация опасны (пагинация в памяти).

**[SM] `LAZY` vs `EAGER`; `LazyInitializationException`.**
*Ловушка:* доступ к ленивому полю вне сессии/транзакции; OSIV, прячущий проблему. *Follow-up:* OSIV это хорошо или плохо? (обычно отключать в проде.)

**[S] Persistence context / first-level cache — что он реально делает?**
*Проверяют:* identity map, dirty checking, момент flush, `flush` vs `commit`. *Follow-up:* когда Hibernate авто-флашит перед запросом?

**[S] `save` / `persist` / `merge` / `saveOrUpdate` — семантика и капкан detached-entity.**
*Ловушка:* `merge` возвращает новый managed-инстанс; мутация исходного ничего не даёт.

**[S] `equals`/`hashCode` для JPA-entity — правильный подход.**
*Проверяют:* не использовать сгенерированный id (null до persist ломает членство в Set); бизнес-ключ или UUID, присвоенный в конструкторе. Senior-дифференциатор.

**[SM] Ошибки маппинга связей (`@OneToMany` owning side, `mappedBy`, cascade, orphanRemoval).**
*Ловушка:* синхронизация двунаправленной связи, сюрпризы cascade `REMOVE`, `CascadeType.ALL` на `@ManyToMany`.

**[S] `@Version` и как Hibernate использует его для оптимистичных блокировок + порядок flush.**

**[SM] DTO-проекция vs entity — почему тянуть entity для read-API часто неправильно.**
*Follow-up:* constructor expressions, проекции в `@Query`, выборка только нужных колонок.

-----

## 17. SQL

**[M] `INNER` vs `LEFT`/`RIGHT`/`FULL` join — и что `NULL` делает с фильтрами.**
*Ловушка:* `WHERE` по правой таблице `LEFT JOIN` молча превращает его в inner.

**[SM] `GROUP BY` + `HAVING` vs `WHERE`; порядок вычисления агрегатов.**
*Follow-up:* логический порядок обработки (FROM→WHERE→GROUP→HAVING→SELECT→ORDER→LIMIT).

**[SM] Оконные функции — реши «top N в группе» или running total.**
*Проверяют:* `ROW_NUMBER`/`RANK`/`DENSE_RANK`, `PARTITION BY`, `OVER`.

**[SM] `EXISTS` vs `IN` vs `JOIN` для подзапроса — производительность и семантика NULL.**
*Ловушка:* `NOT IN` с NULL в подзапросе вернёт ноль строк.

**[S] Как найти и починить медленный запрос?**
*Скелет:* `EXPLAIN (ANALYZE, BUFFERS)` → seq scan vs index scan → отсутствующий/не-sargable предикат → индекс / переписать → перемерить. *Follow-up:* что делает предикат не-sargable? (функция на колонке, ведущий wildcard, неявный каст.)

**[SM] CTE и рекурсивные CTE — кейс (дерево оргструктуры / граф).**
*Follow-up:* материализация CTE в PG (изменилось в PG12).

**[M] `DISTINCT` vs `GROUP BY`; `UNION` vs `UNION ALL`.**

-----

## 18. PostgreSQL

**[S] MVCC — как Postgres обрабатывает конкурентные чтения/записи без блокировок на чтение?**
*Проверяют:* версии строк (tuples), видимость, читатели не блокируют писателей. *Follow-up:* что такое bloat и зачем `VACUUM`? тюнинг autovacuum.

**[S] `VACUUM` vs `VACUUM FULL` vs `ANALYZE` — что делает каждый и блокировки.**
*Ловушка:* `VACUUM FULL` берёт эксклюзивную блокировку (переписывает таблицу).

**[SM] Изоляция в PG: Read Committed vs Repeatable Read (snapshot) vs Serializable (SSI).**
*Follow-up:* serialization failures и логика ретраев.

**[S] Управление соединениями — почему «слишком много» вредит и как лечить.**
*Проверяют:* каждое соединение = backend-процесс; PgBouncer; размер пула (`~ (cores*2)+spindles` как rule of thumb). *Follow-up:* нюансы transaction/session pooling с prepared statements.

**[SM] `JSONB` vs `JSON` vs нормализованные колонки — когда тянуться к JSONB.**
*Follow-up:* GIN-индекс по JSONB; цена злоупотребления.

**[SM] `SELECT ... FOR UPDATE [SKIP LOCKED]` — очередь задач на PG.**
*Проверяют:* `SKIP LOCKED` для конкурентных воркеров без контеншена.

**[S] Репликация: streaming vs logical; sync vs async; устаревание read-реплики.**
*Follow-up:* проблема read-your-own-writes на репликах.

-----

## 19. Индексы и оптимизация запросов

**[SM] B-tree индекс — когда используется и когда игнорируется?**
*Ловушка:* функция на колонке, низкая селективность, ведущий wildcard. *Follow-up:* порядок колонок в составном индексе (leftmost-prefix).

**[S] Covering index / index-only scan — что и зачем.**
*Проверяют:* `INCLUDE`-колонки, избегание heap fetch (зависимость от visibility map в PG).

**[SM] Типы индексов в PG: B-tree, Hash, GIN, GiST, BRIN — выбрать под сценарий.**
*Follow-up:* GIN для full-text/JSONB/массивов; BRIN для огромных append-only time-series.

**[S] Почему добавление индекса иногда замедляет систему?**
*Проверяют:* write amplification, bloat, ошибки планировщика, блокировка при создании (`CREATE INDEX CONCURRENTLY`).

**[SM] Partial и expression-индексы — реальный кейс.**
*Пример:* индекс только `WHERE status='ACTIVE'`; индекс по `lower(email)`.

**[S] Чтение `EXPLAIN ANALYZE`: estimated vs actual rows, nested loop vs hash join, устаревшая статистика.**

-----

## 20. Kafka / messaging

**[M] Topic, partition, offset, consumer group — базовая модель.**
*Проверяют:* параллелизм ограничен числом партиций; одна партиция → один consumer в группе.

**[SM] Гарантии порядка — что Kafka реально гарантирует?**
*Проверяют:* порядок только внутри партиции. *Follow-up:* как держать порядок по сущности (партиционирование по ключу); что ломает порядок (ретраи, несколько продюсеров).

**[S] Семантика доставки: at-most-once / at-least-once / exactly-once.**
*Проверяют:* настройки ack, idempotent producer, транзакции; идемпотентность на стороне consumer всё равно нужна. *Ловушка:* верить, что EOS снимает нужду в идемпотентных consumer’ах между системами.

**[S] Rebalancing consumer’ов — что триггерит и какова цена.**
*Проверяют:* stop-the-world vs cooperative-sticky; долгая обработка → session timeout → шторма ребалансов. *Follow-up:* `max.poll.interval.ms`, heartbeat, pause.

**[S] Commit offset: auto vs manual; окно дубликатов/потерь.**
*Ловушка:* commit-до-обработки (потеря) vs обработка-до-commit (дубликаты). *Follow-up:* где именно коммитить для at-least-once.

**[S] Обработка poison message / отказа обработки.**
*Проверяют:* retry topic, dead-letter queue, backoff; не блокировать партицию навечно.

**[SM] Kafka vs RabbitMQ vs SQS — выбрать под кейс.**
*Проверяют:* лог/replay/высокий throughput streaming vs гибкая маршрутизация/ack по сообщению.

**[S] Transactional outbox — зачем и как.**
*Скелет:* бизнес-строка + outbox-строка в одной транзакции БД; relay публикует в Kafka; решает dual-write. Вариант с CDC (Debezium).

-----

## 21. Redis / кэширование

**[M] Cache-aside vs read-through vs write-through vs write-behind.**

**[SM] Стратегии инвалидации и дизайн TTL.**
*Ловушка:* устаревшие данные, рассинхрон кэша и БД при записи. *Follow-up:* инвалидировать vs обновлять при записи.

**[S] Cache stampede / thundering herd при истечении — предотвращение.**
*Проверяют:* coalescing/lock запросов, jittered TTL, ранний/probabilistic refresh.

**[SM] Структуры Redis под реальные задачи (rate limiter, leaderboard, session).**
*Проверяют:* sorted sets для leaderboard, `INCR`+TTL или token bucket для rate limit, HLL для кардинальности.

**[S] Распределённый лок на Redis — безопасен ли `SETNX`/Redlock?**
*Проверяют:* fencing tokens, проблемы часов, спор вокруг Redlock; локу нужен TTL + проверка владельца при release (Lua). Senior-дифференциатор.

**[SM] Персистентность Redis: RDB vs AOF; что теряешь при крэше?**
*Follow-up:* Redis как кэш vs источник истины.

**[S] Проблемы hot key / big key и митигация.**

-----

## 22. Microservices

**[SM] Когда микросервисы НЕ нужны?**
*Проверяют:* распределённый монолит, преждевременная декомпозиция, согласование с командами (Conway). Вопрос на senior-суждение.

**[S] Как определять границы сервисов?**
*Проверяют:* bounded contexts (DDD), владение данными, когезия изменений. *Ловушка:* границы по техслоям вместо домена.

**[S] Sync vs async коммуникация между сервисами — компромиссы.**
*Follow-up:* связность request-response, накопление латентности, choreography vs orchestration.

**[S] Консистентность данных между сервисами — распределённых транзакций нет, что делать?**
*Проверяют:* saga (orchestration vs choreography), компенсирующие действия, eventual consistency, outbox. *Follow-up:* обработка частичного отказа саги.

**[SM] Service discovery, клиентская vs серверная балансировка, роль API gateway.**

**[S] Общая БД между сервисами — почему это анти-паттерн.**

**[SM] Распределённый трейсинг — как проследить один запрос через 5 сервисов?**
*Проверяют:* trace/span ID, проброс контекста (W3C traceparent), correlation ID в логах.

-----

## 23. Распределённые системы

**[S] CAP-теорема — и более полезная PACELC.**
*Ловушка:* упрощение «выбери 2 из 3»; партиции не опциональны. *Follow-up:* классифицируй знакомую систему.

**[S] Идемпотентность в распределённых системах — зачем и как реализовать.**
*Проверяют:* dedup-ключи, idempotency-хранилище, идемпотентные получатели. Связь с ретраями.

**[S] At-least-once доставка значит, что дубликаты БУДУТ — проектируй под это.**

**[S] Консенсус — почему это трудно? (Raft/Paxos на высоком уровне)**
*Follow-up:* где встречается консенсус (выбор лидера, etcd/ZooKeeper, контроллер Kafka).

**[S] Проблемы часов: почему нельзя доверять timestamp для упорядочивания между узлами.**
*Проверяют:* логические часы, Lamport/vector clocks, hybrid logical clocks.

**[S] Eventual consistency — как сделать её приемлемой для продукта/пользователя?**
*Follow-up:* read-your-writes, monotonic reads, UX-паттерны.

**[S] Как проектировать graceful degradation при частичном отказе?**
*Проверяют:* bulkheads, circuit breakers, fallback’и, load shedding.

-----

## 24. System Design (вести как открытый диалог, не Q&A)

**[S] Спроектируй сокращатель ссылок.**
*Зондировать:* генерация ключа (счётчик vs hash vs base62), коллизии, кэш под read-heavy, выбор БД, аналитика, оценка масштаба.

**[S] Спроектируй rate limiter (per-user, распределённый).**
*Зондировать:* token bucket vs sliding window, где состояние (Redis), атомарность, корректность на нескольких узлах, режим отказа (fail-open vs fail-closed).

**[S] Спроектируй обработку платежей/заказов с эффектом exactly-once.**
*Зондировать:* idempotency keys, outbox, saga, ретраи, сверка, аудит.

**[S] Спроектируй ленту/таймлайн.**
*Зондировать:* fan-out on write vs read, горячие пользователи, кэш, ранжирование, консистентность пагинации.

**[S] Спроектируй сервис нотификаций (email/push/SMS) на масштабе.**
*Зондировать:* очереди, ретраи/backoff, dedup, rate limit на провайдера, DLQ, трекинг доставки.

**[S] Спроектируй планировщик задач.**
*Зондировать:* at-least-once исполнение, выбор лидера, пропущенные запуски, идемпотентность, очередь на БД со SKIP LOCKED vs брокер.

**[S] Спроектируй чат.**
*Зондировать:* доставка/read receipts, порядок, presence, websockets vs polling, хранение сообщений, fan-out.

*Для каждого: начни с требований + цифр масштаба, опиши API, модель данных, затем узкие места и компромиссы. Проговаривай допущения вслух.*

-----

## 25. Тестирование

**[M] Unit vs integration vs e2e — пирамида тестов и когда она неверна.**

**[SM] Mock vs stub vs spy vs fake — и запах over-mocking.**
*Ловушка:* мокать то, чем не владеешь; тесты, проверяющие взаимодействия вместо поведения.

**[SM] Testcontainers — зачем тестировать на реальном Postgres/Kafka, а не на H2/embedded?**
*Проверяют:* расхождение диалекта/поведения, реалистичная интеграция. Strong-middle дифференциатор.

**[SM] Слайсы `@SpringBootTest` (`@WebMvcTest`, `@DataJpaTest`) — почему не всегда полный контекст?**
*Проверяют:* скорость, изоляция, кэширование контекста.

**[S] Как тестировать конкурентный / зависящий от времени код?**
*Проверяют:* детерминированные планировщики, инъекция `Clock`, awaitility, без `Thread.sleep`.

**[SM] Flaky-тесты — частые причины и как чинить флакающий suite.**
*Проверяют:* общее состояние, порядок, реальное время, внешние зависимости, async без нормальных ожиданий.

**[S] Контрактное тестирование между сервисами (consumer-driven).**
*Follow-up:* Pact/Spring Cloud Contract; почему лучше хрупкого e2e.

-----

## 26. Observability

**[M] Логи vs метрики vs трейсы — на что отвечает каждый.**

**[SM] Структурированное логирование и correlation ID — зачем и как.**
*Проверяют:* MDC, JSON-логи, проброс трейса; не логировать PII/секреты.

**[SM] Четыре golden signals (latency, traffic, errors, saturation) / RED / USE.**

**[S] Тебя разбудил пейдж: подскочила p99-латентность. Проведи расследование.**
*Скелет:* дашборды (какой эндпоинт/зависимость), трейсы на медленные спаны, корреляция с деплоями/GC/БД/локами/saturation, гипотеза, митигация (rollback/scale), затем root-cause. *Follow-up:* отличие проблемы p50 от p99.

**[SM] Взрыв кардинальности в метриках — что это и почему убивает TSDB.**
*Ловушка:* user-id как label.

**[S] SLI/SLO/SLA и error budgets — как меняют инженерные решения?**

-----

## 27. Надёжность в проде

**[SM] Таймауты — почему «нет таймаута» это самый частый прод-баг?**
*Проверяют:* connect vs read timeout, каскадные зависания, истощение пула потоков. *Follow-up:* выставить таймауты на HTTP-клиенте, БД, downstream.

**[S] Ретраи, сделанные неправильно — как ретраи вызывают аварии.**
*Проверяют:* retry storms, ретрай неидемпотентных операций, ретрай не на тех ошибках. *Follow-up:* exponential backoff + jitter, retry budget, предусловие идемпотентности.

**[S] Circuit breaker — состояния и какую проблему решает.**
*Проверяют:* closed/open/half-open; быстрый отказ vs добивание умирающей зависимости. (Resilience4j.)

**[S] Backpressure — что это и как применять?**
*Проверяют:* ограниченные очереди, load shedding, ранний отказ vs бесконечная очередь.

**[S] Idempotency keys для write-API — спроектируй хранилище и TTL.**

**[S] Bulkheads и изоляция ресурсов — чтобы одна медленная зависимость не утопила всё.**

**[SM] Graceful degradation vs быстрый отказ — выбрать под сценарий.**

**[S] Как сделать zero-downtime деплой с изменением схемы БД?**
*Скелет:* expand-contract / обратносовместимые миграции, многофазно (добавить nullable-колонку → backfill → переключить чтения → удалить), без блокирующих локов, `CREATE INDEX CONCURRENTLY`. Senior-дифференциатор.

-----

## 28. Docker / Kubernetes

**[M] Слои образа и почему билд медленный / образ огромный.**
*Проверяют:* кэш слоёв, multi-stage, `.dockerignore`, маленький base image. *Ловушка:* `COPY . .` до резолва зависимостей сбивает кэш.

**[SM] Контейнер vs VM; почему «у меня работает» случается и с контейнерами.**

**[SM] K8s: pod, deployment, service, replicaset — и механика rolling update.**

**[SM] Liveness vs readiness vs startup probes — ошибка тут роняет прод.**
*Ловушка:* liveness, падающий под нагрузкой → цикл рестартов; readiness гейтит трафик. Strong-middle дифференциатор.

**[S] Requests vs limits; что такое OOMKilled; CPU throttling.**
*Follow-up:* JVM в контейнере — размер heap, `MaxRAMPercentage`, осведомлённость о cgroup.

**[SM] ConfigMap vs Secret; 12-factor конфиг.**

**[S] Как запрос доходит до пода? (Ingress → Service → kube-proxy → pod)**

-----

## 29. CI/CD

**[M] CI vs CD vs continuous deployment — различия.**

**[SM] Что должно быть в хорошем пайплайне и в каком порядке?**
*Проверяют:* build → unit → integration → static analysis/security scan → артефакт → деплой → smoke. Падать рано.

**[SM] Blue-green vs canary vs rolling — компромиссы.**

**[S] Миграции БД в CI/CD — Flyway/Liquibase и проблема отката.**
*Ловушка:* деструктивные миграции + откат; философия forward-only; обратносовместимые изменения (связь с §27).

**[SM] Секреты в пайплайнах, версионирование артефактов, воспроизводимость билда.**

-----

## 30. Алгоритмы и структуры данных (релевантные backend)

**[M] Big-O частых операций коллекций — и амортизированный анализ (add в ArrayList).**

**[SM] Хеширование: коллизии, load factor, когда хеширование деградирует.**

**[SM] Two-pointer / sliding window — типовая задача.**
*Примеры:* длиннейшая подстрока без повторов; макс. сумма подмассива размера k.

**[SM] Top-K элементов — heap vs sort vs quickselect.**

**[SM] BFS vs DFS — и backend-применение (граф зависимостей, кратчайший путь).**

**[S] Реализация LRU-кэша (HashMap + двусвязный список).**

**[SM] Бинарный поиск и его варианты (первое/последнее вхождение, повёрнутый массив).**

**[S] Когда Bloom filter — правильный инструмент? чем платишь?**
*Проверяют:* вероятностный, нет false negatives, экономия памяти на проверке членства.

**[SM] Сортировки: почему нижняя граница O(n log n); когда counting/radix быстрее.**

*Примечание: большинство backend-собеседований остаются на easy/medium; глубина в хешировании, кучах, two-pointer и обходе графов покрывает основное.*

-----

## 31. Behavioral / по опыту

**[SM] Расскажи про прод-инцидент, который ты вызвал или разрулил.**
*Проверяют:* ownership, дисциплина root-cause, blameless postmortem, профилактика.

**[S] Случай, когда ты не соглашался с техническим решением — что сделал?**
*Проверяют:* disagree-and-commit, влияние без полномочий.

**[SM] Самый сложный баг, который отлаживал.**
*Проверяют:* системный подход, инструменты, не везение.

**[S] Как принимаешь решение build-vs-buy или выбор технологии?**
*Проверяют:* рассуждение о компромиссах, полная стоимость, обратимость.

**[SM] Случай, когда срезал scope / выпустил неидеальное ради дедлайна.**
*Проверяют:* прагматизм vs gold-plating, коммуникация компромиссов.

**[S] Как ревьюишь большой PR / менторишь джуна?**

**[SM] Опиши свою философию тестирования/качества.**

*Используй STAR (Situation, Task, Action, Result). На senior-собеседовании суждение и коммуникация весят не меньше технического ответа.*

-----

## 32. Build tools: Maven / Gradle

**[M] Maven scopes (compile/provided/runtime/test) — что значит каждый.**
*Проверяют:* classpath на разных фазах. *Follow-up:* зачем `provided` (например servlet-api)?

**[SM] Транзитивные зависимости и разрешение конфликта версий.**
*Проверяют:* Maven «nearest-wins» vs Gradle «highest-wins». *Ловушка:* думать, что обе системы выбирают одинаково. *Follow-up:* как найти, откуда тянется версия (`mvn dependency:tree`, `gradle dependencies`)?

**[SM] Dependency hell / diamond dependency — как лечить.**
*Follow-up:* `dependencyManagement`, BOM, `<exclusions>`, Gradle `constraints`/`resolutionStrategy`.

**[SM] BOM — что это и зачем (Spring Boot dependencies BOM).**
*Проверяют:* централизованное управление версиями без объявления самих зависимостей.

**[M] Жизненный цикл Maven (validate→compile→test→package→verify→install→deploy); phase vs goal.**
*Follow-up:* почему `mvn install` запускает тесты.

**[SM] Multi-module проект — parent pom, reactor build, порядок сборки.**

**[SM] Gradle: task graph, incremental build, build cache.**
*Проверяют:* up-to-date checks, inputs/outputs. *Follow-up:* почему Gradle обычно быстрее на пересборках.

**[SM] Gradle configuration vs execution phase; почему `dependsOn` ≠ императивный вызов.**

**[SM] Fat/uber jar vs обычный jar; Spring Boot repackage и layered jars для Docker.**
*Follow-up:* зачем layered jars (кэш слоёв образа).

-----

## 33. HTTP (глубже, чем REST)

**[M] Структура запроса/ответа; статусные классы 1xx–5xx.**

**[SM] Idempotent vs safe методы на уровне протокола.**
*Проверяют:* GET safe, PUT/DELETE idempotent, POST нет. Связь с ретраями.

**[SM] Кэширующие заголовки: `Cache-Control`, `ETag`, `Last-Modified`, conditional requests.**
*Проверяют:* `If-None-Match`/`If-Modified-Since` → 304. *Follow-up:* strong vs weak ETag.

**[SM] CORS — кто проверяет и почему «CORS не работает» это обычно бэкенд.**
*Ловушка:* думать, что CORS защищает сервер (это браузерный механизм). *Follow-up:* preflight (OPTIONS), `Access-Control-Allow-*`, credentials.

**[SM] Cookies: `HttpOnly`, `Secure`, `SameSite`, scope.**
*Follow-up:* связь `SameSite` с CSRF.

**[S] Keep-alive, connection pooling, HTTP/1.1 vs HTTP/2 (мультиплексирование) vs HTTP/3.**
*Проверяют:* head-of-line blocking, зачем пул соединений на клиенте. *Follow-up:* socket exhaustion без переиспользования.

**[SM] Сжатие (gzip/brotli) — где включать и компромиссы.**

**[M] TLS базово: что даёт, handshake в двух словах, termination на reverse proxy.**

**[SM] Reverse proxy / load balancer (nginx, Envoy) — что снимают с приложения; L4 vs L7.**

**[SM] Chunked transfer / streaming — когда не буферизовать весь ответ.**

-----

## 34. Serialization / JSON / Jackson

**[M] Как `ObjectMapper` мапит JSON в POJO.**
*Follow-up:* почему `ObjectMapper` дорого создавать и его переиспользуют (thread-safe).

**[SM] Unknown fields — поведение по умолчанию и настройка.**
*Ловушка:* `FAIL_ON_UNKNOWN_PROPERTIES` падает на новых полях → ломает forward-compatibility. *Follow-up:* `@JsonIgnoreProperties(ignoreUnknown=true)`.

**[SM] Даты в Jackson: `LocalDateTime` vs `Instant`, таймзоны, `WRITE_DATES_AS_TIMESTAMPS`.**
*Ловушка:* сериализовать `LocalDateTime` без зоны и потерять смысл момента. *Follow-up:* `JavaTimeModule`, ISO-8601.

**[S] Полиморфная десериализация (`@JsonTypeInfo`/`@JsonSubTypes`) и её риски.**
*Ловушка:* default typing → десериализация произвольных типов = RCE. *Follow-up:* почему `enableDefaultTyping` опасен.

**[SM] Эволюция DTO: backward/forward compatibility, эволюция enum.**
*Ловушка:* падать на неизвестном значении enum; `READ_UNKNOWN_ENUM_VALUES_AS_NULL`.

**[SM] Circular references при сериализации entity.**
*Follow-up:* `@JsonManagedReference`/`@JsonBackReference`, и почему лучше DTO.

**[M] `@JsonProperty`, `@JsonCreator`, `@JsonInclude(NON_NULL)` — частые применения.**

**[SM] Иммутабельные объекты и Jackson (конструкторная десериализация, Kotlin/records).**

-----

## 35. Время, даты, таймзоны

**[SM] `Instant` vs `LocalDateTime` vs `ZonedDateTime` vs `OffsetDateTime` — что выбрать.**
*Проверяют:* `Instant`/UTC для момента, `LocalDate(Time)` для «настенного» времени. *Ловушка:* хранить момент как `LocalDateTime`.

**[SM] Как хранить время в БД (`timestamptz` vs `timestamp`)?**
*Проверяют:* в PG `timestamptz` хранит в UTC; `timestamp` без зоны — ловушка.

**[S] DST — что ломает: cron, длительности, «прибавить день».**
*Ловушка:* `plusHours(24)` ≠ «следующий день» в DST. *Follow-up:* арифметику дат — в зоне пользователя, моменты — в UTC.

**[SM] Таймзона пользователя vs сервера vs БД — где конвертировать.**
*Проверяют:* хранить UTC, конвертировать на краю.

**[M] Эпоха, секунды/миллисекунды — частые баги.**

**[SM] TTL/expiry в распределённых системах при clock drift.**
*Follow-up:* монотонные часы для длительностей, wall-clock для дедлайнов.

**[SM] Cron — таймзона планировщика, перекрытие запусков, пропуски.**

-----

## 36. Spring Data / репозитории

**[M] Derived query methods (`findByEmailAndStatus`) — как строятся.**
*Ловушка:* монструозные имена; когда переходить на `@Query`.

**[SM] `@Query` (JPQL vs native) — когда что и риски native.**

**[SM] Проекции: интерфейсные vs DTO-based vs dynamic.**
*Проверяют:* выбор только нужных колонок вместо entity.

**[SM] `Page` vs `Slice` vs `List` — разница и цена.**
*Проверяют:* `Page` делает дополнительный `count`-запрос (дорого); `Slice` нет.

**[S] Где транзакционная граница: репозиторий или сервис?**
*Проверяют:* `@Transactional` на сервисном слое оборачивает бизнес-операцию. Связь с §15.

**[SM] Locking-аннотации: `@Lock(PESSIMISTIC_WRITE)`, `@Version` через Spring Data.**

**[SM] Custom repository (fragment + impl) — когда нужен.**

**[SM] `getReferenceById` (lazy proxy) vs `findById` — капкан.**
*Ловушка:* `getReferenceById` бросает при доступе, если сущности нет.

-----

## 37. Валидация и доменные инварианты

**[SM] Где должна жить валидация: request / domain / БД?**
*Проверяют:* request-валидация (формат) ≠ доменные инварианты (бизнес-правила) ≠ ограничения БД (последняя линия). *Follow-up:* почему нельзя полагаться только на Bean Validation.

**[S] Проверка уникальности: почему `if (exists) throw` это гонка.**
*Проверяют:* race между проверкой и вставкой; нужна `UNIQUE`-constraint + обработка `ConstraintViolation`. Senior-дифференциатор.

**[SM] Доменные инварианты внутри агрегата vs валидация на входе.**
*Follow-up:* объект не должен иметь возможности быть в невалидном состоянии (валидация в конструкторе/фабрике).

**[SM] Optimistic locking как защита инварианта при конкурентном изменении.**

**[M] Bean Validation: встроенные аннотации, кастомный валидатор, группы, каскад (`@Valid`).**

**[SM] Валидация на границе между сервисами — нельзя доверять входу.**

-----

## 38. DDD / доменное моделирование

**[SM] Entity vs Value Object — разница и примеры.**
*Проверяют:* идентичность vs значение; VO иммутабелен, сравнивается по значению (Money, Address).

**[S] Aggregate и aggregate root — зачем граница.**
*Проверяют:* агрегат = граница консистентности и транзакции; снаружи ссылаются только на root по id. *Follow-up:* почему один агрегат — одна транзакция.

**[SM] Anemic domain model — почему анти-паттерн (и контраргументы).**

**[SM] Domain service vs application service — разделение.**
*Проверяют:* доменная логика без состояния vs оркестрация (транзакция, безопасность).

**[S] Domain events — зачем и как не сломать транзакционность.**
*Follow-up:* публикация после коммита, связь с outbox (§15, §20).

**[SM] Repository в терминах DDD — отличие от Spring Data репозитория.**
*Проверяют:* коллекция агрегатов, а не CRUD на таблицу.

**[S] Bounded context и context map — связь с границами сервисов.**

**[SM] Транзакционная граница вокруг агрегата.**

-----

## 39. Архитектурные паттерны

**[M] Layered architecture — слои и правило зависимостей.**
*Ловушка:* протекание JPA-entity во все слои.

**[S] Hexagonal / ports-and-adapters — какую проблему решает.**
*Проверяют:* домен не зависит от инфраструктуры; порты = интерфейсы, адаптеры = реализации. *Follow-up:* куда смотрят зависимости (внутрь).

**[S] Clean architecture — dependency rule; чем отличается от гексагональной.**

**[SM] Modular monolith — когда лучше микросервисов.**

**[S] Event-driven architecture — плюсы (развязка) и минусы (отлаживаемость, eventual consistency).**

**[S] CQRS — когда оправдан и его цена.**
*Ловушка:* тащить CQRS без причины.

**[S] Event sourcing — что хранится, плюсы (аудит, time-travel) и боль (схема событий, проекции, snapshot’ы).**

**[SM] Как выбрать архитектуру под задачу — критерии, а не мода.**

-----

## 40. Reactive stack (Reactor / WebFlux)

**[M] `Mono` vs `Flux` и lazy-природа (ничего без subscribe).**

**[SM] WebFlux vs Spring MVC — когда реактивщина оправдана.**
*Ловушка:* WebFlux поверх блокирующего JDBC.

**[S] Блокирующий вызов в реактивном пайплайне — почему катастрофа.**
*Проверяют:* блокировка event-loop потока; `subscribeOn(boundedElastic)` как обход. Senior-дифференциатор.

**[S] `subscribeOn` vs `publishOn` — что на какой поток влияет.**
*Ловушка:* думать, что несколько `subscribeOn` складываются (берётся первый).

**[SM] Backpressure в Reactor — стратегии (`onBackpressureBuffer/Drop/Latest`).**

**[SM] Schedulers: `parallel` vs `boundedElastic` vs `single`.**

**[SM] Обработка ошибок: `onErrorResume`/`onErrorReturn`/`retryWhen`.**

**[S] Когда реактивщина НЕ нужна (и virtual threads как альтернатива).**

-----

## 41. gRPC / GraphQL / OpenAPI

**[SM] OpenAPI: contract-first vs code-first — компромиссы.**

**[SM] gRPC — плюсы/минусы против REST.**
*Проверяют:* HTTP/2, бинарный protobuf, стриминг, строгий контракт; минусы — браузер, отладка, читаемость.

**[S] Protobuf schema evolution — правила обратной совместимости.**
*Проверяют:* не переиспользовать номера полей, не менять типы; почему номера важнее имён.

**[S] GraphQL N+1 и DataLoader.**
*Проверяют:* резолверы порождают N+1; DataLoader батчит. *Follow-up:* ограничение глубины/сложности запроса.

**[SM] Когда НЕ брать GraphQL.**
*Проверяют:* простой CRUD, HTTP-кэширование, авторизация по полям.

**[M] Что считается breaking change в API.**

-----

## 42. Application security / OWASP

**[S] OWASP Top 10 — назови основные и приведи бэкенд-пример.**

**[S] SQL injection — как возникает и закрывается.**
*Проверяют:* конкатенация vs параметризация; ORM не панацея (native-запросы). *Follow-up:* почему `PreparedStatement` спасает.

**[SM] XSS — типы и где ответственность бэкенда (экранирование, CSP).**

**[S] SSRF — почему опасно в облаке.**
*Проверяют:* сервер дёргает произвольный URL → доступ к internal/metadata endpoint. *Follow-up:* allowlist, запрет приватных диапазонов.

**[SM] CSRF — когда актуален (cookie vs bearer) и как защищаться.**

**[SM] Ошибки CORS, открывающие дыру (`*` + credentials, отражение Origin).**

**[S] Авторизация на уровне объекта (IDOR / object-level authz).**
*Проверяют:* проверять владение ресурсом, а не только аутентификацию. Частая дыра.

**[SM] Хранение и ротация секретов; mTLS между сервисами.**

**[SM] Безопасный сброс пароля (одноразовый токен, TTL, без утечки существования аккаунта).**

**[SM] Логи аудита и маскирование PII; что нельзя логировать.**

**[SM] Rate limiting как защита (brute-force, abuse).**

-----

## 43. Networking basics

**[M] TCP vs UDP — гарантии и где что.**
*Follow-up:* почему HTTP на TCP, а DNS/видео часто UDP/QUIC.

**[SM] Connect timeout vs read timeout — разница и почему оба обязательны.**

**[S] Socket exhaustion / нехватка ephemeral ports — причина и симптомы.**
*Проверяют:* TIME_WAIT, отсутствие переиспользования соединений. *Follow-up:* pooling, keep-alive.

**[M] DNS — резолв, TTL и кэширование (в т.ч. JVM DNS cache).**
*Ловушка:* JVM кэширует DNS «навечно» по умолчанию — проблема при смене IP.

**[SM] TLS handshake в общих чертах; где терминируется TLS.**

**[SM] Алгоритмы балансировки (round-robin, least-connections, hashing).**

**[M] NAT, приватные диапазоны, «localhost у меня работает».**

-----

## 44. Linux / эксплуатация

**[M] Базовая диагностика инцидента: `top`/`htop`, `ps`, `df`, `free`.**

**[SM] Сетевая диагностика: `ss`/`netstat`, `curl`, `dig`, `tcpdump`.**
*Follow-up:* проверить, слушает ли порт; куда резолвится домен.

**[SM] File descriptors и `ulimit` — «Too many open files».**
*Проверяют:* лимит FD, утечка соединений/файлов; `lsof`. Частый прод-инцидент.

**[SM] Сигналы (SIGTERM/SIGKILL/SIGHUP) и graceful shutdown.**
*Проверяют:* SIGTERM → корректное завершение; SIGKILL не перехватить. Связь с K8s preStop.

**[M] Exit codes; что значат 137 (OOMKilled) и 143 (SIGTERM).**

**[SM] Диск заполнен / исчерпание inode.**
*Ловушка:* `df` показывает место, но `df -i` — inode кончились.

**[SM] Память процесса: RSS vs heap, почему контейнер OOMKilled при «нормальном» heap.**
*Follow-up:* off-heap, metaspace, native, thread stacks.

-----

## 45. Проектирование схемы БД

**[SM] Нормализация vs денормализация — когда осознанно денормализовать.**

**[SM] Constraints: PK, FK, UNIQUE, CHECK, NOT NULL — зачем держать в БД, а не только в коде.**
*Проверяют:* БД как последняя линия консистентности. Связь с §37.

**[S] UUID vs bigint в качестве id — компромиссы.**
*Проверяют:* UUID (генерация на клиенте, шардинг) vs bigint (локальность индекса, размер); UUIDv7/ULID как компромисс. *Follow-up:* фрагментация B-tree от случайных UUID.

**[SM] Soft delete (`deleted_at`) — плюсы и скрытые издержки.**
*Ловушка:* забыть фильтр → утечка удалённых; конфликт с уникальными индексами.

**[S] Партиционирование таблицы — когда и по какому ключу.**
*Проверяют:* range (по времени) vs list vs hash; обрезка партиций; архивация.

**[S] Шардинг — когда неизбежен и какова цена.**
*Проверяют:* выбор shard key, кросс-шард запросы, ребалансировка.

**[SM] Audit-таблицы / история изменений (триггеры, app-level, temporal).**

**[SM] Sequence gaps — почему id «прыгают» и почему это нормально.**

**[SM] Стратегия миграций: обратносовместимые изменения, expand-contract (связь с §27).**

-----

## 46. Search / full-text / Elasticsearch

**[SM] Inverted index — чем поиск отличается от B-tree в РСУБД.**

**[SM] Analyzers / tokenization / stemming — влияние на релевантность.**

**[S] Консистентность между БД и поисковым индексом.**
*Проверяют:* индекс обновляется отдельно → eventual consistency; синхронизация через CDC/outbox; dual-write проблема. Связь с §20.

**[SM] Реиндексация без даунтайма (alias + новый индекс).**

**[SM] Глубокая пагинация: `from/size` vs `search_after`/scroll.**
*Ловушка:* глубокий `from` дорогой (как offset в SQL).

**[M] Когда хватает full-text в PostgreSQL, а когда нужен отдельный движок.**

-----

## 47. Object storage / файлы

**[SM] S3/MinIO — модель объектного хранилища vs файловая система.**
*Проверяют:* нет директорий (префиксы), неизменяемость объекта, консистентность.

**[SM] Presigned URL — зачем (прямая загрузка/скачивание мимо бэкенда).**
*Follow-up:* срок жизни, права.

**[SM] Multipart upload больших файлов.**

**[SM] Жизненный цикл файла: загрузка → валидация → доступность; согласованность метаданных в БД и объекта.**
*Ловушка:* запись в БД + загрузка в storage — это dual-write.

**[M] CDN перед storage — что даёт и инвалидация.**

-----

## 48. Feature flags / config rollout

**[SM] Feature flags — зачем (раздельный деплой и релиз, kill switch).**
*Проверяют:* выкатка кода ≠ включение фичи; откат без редеплоя.

**[SM] Постепенный rollout (% пользователей, кохорты) и измерение.**

**[SM] Динамический конфиг vs статический; config drift между средами.**

**[M] Тестирование с флагами — комбинаторный взрыв состояний.**

**[SM] Технический долг флагов — почему их надо удалять.**

-----

## 49. Performance engineering

**[SM] Throughput vs latency — почему одно улучшают ценой другого.**

**[SM] p50/p95/p99 — почему среднее обманывает.**
*Проверяют:* хвосты латентности; почему p99 важен для UX.

**[S] Little’s Law (L = λ × W) — применить к sizing и очередям.**

**[S] Queueing: почему латентность взрывается у предела утилизации (~80%).**
*Проверяют:* нелинейный рост ожидания при росте загрузки.

**[SM] «Profile before you optimize».**
*Ловушка:* угадывать узкое место вместо измерения.

**[SM] Нагрузочное тестирование: k6/JMeter/Gatling — что мерить и ошибки.**
*Ловушка:* тест без прогрева/реалистичных данных; coordinated omission.

**[S] Capacity planning — сколько инстансов нужно под нагрузку.**

-----

## 50. Cloud basics

**[M] Managed DB vs self-hosted — что облако берёт на себя и чем платишь.**

**[SM] IAM — принцип наименьших привилегий; роли vs ключи.**

**[SM] VPC / security groups / приватные подсети — базовая изоляция.**

**[SM] Availability zones — проектирование под отказ зоны.**

**[S] Backups, disaster recovery, RPO/RTO — что значат для дизайна.**
*Проверяют:* RPO (сколько данных допустимо потерять) vs RTO (за сколько восстановиться).

**[M] Autoscaling — по какому сигналу и почему «просто по CPU» часто плохо.**

-----

## 51. Kotlin backend extras

**[SM] `all-open` / `no-arg` плагины — зачем для Spring/JPA.**
*Проверяют:* Kotlin-классы `final` по умолчанию, а Spring AOP/JPA-прокси требуют open; no-arg для JPA-конструктора. *Ловушка:* `@Transactional` не работает на final-методе без плагина.

**[S] JPA-entity на Kotlin — подводные камни.**
*Проверяют:* data class как entity (equals/hashCode), `val` vs `var`, lazy-прокси, no-arg конструктор, nullable id. Связь с §16.

**[SM] Nullability + Jackson: non-null Kotlin-поле приходит null из JSON.**
*Ловушка:* Jackson может присвоить null в non-null поле без Kotlin-модуля. *Follow-up:* `jackson-module-kotlin`.

**[SM] `lateinit` vs `by lazy` — когда что и риски.**
*Ловушка:* `lateinit` для примитивов нельзя; доступ до инициализации бросает.

**[SM] Делегирование (`by`) — делегаты свойств и классов.**

**[SM] `List` vs `MutableList` — read-only интерфейс, а не гарантированная immutability.**

-----

## 52. SOLID и design patterns

**[M] SOLID — назови пять и объясни каждый коротко с примером.**

**[SM] SRP — что значит «одна причина для изменения»?**
*Ловушка:* понимать как «класс делает одну вещь» дословно; на деле — одна ось изменения / один stakeholder.

**[SM] OCP — open/closed на примере.**
*Проверяют:* расширение без правки (Strategy вместо разрастающегося `switch`). *Follow-up:* где это перебор.

**[SM] LSP — приведи нарушение.**
*Проверяют:* подтип, сужающий контракт / бросающий там, где базовый не бросает (квадрат-прямоугольник). *Follow-up:* как это ломает полиморфизм.

**[SM] ISP — толстые интерфейсы; разбиение.**

**[S] DIP — инверсия зависимостей это НЕ то же самое, что DI-контейнер.**
*Проверяют:* DIP про направление зависимости (на абстракцию), DI — механизм внедрения. Senior-дифференциатор.

**[SM] Coupling vs cohesion; DRY/KISS/YAGNI — и когда DRY вредит.**
*Ловушка:* преждевременная абстракция ради «не повторяться» связывает несвязанное.

**[M] Law of Demeter; train wreck (`a.getB().getC().doX()`).**

**[SM] GoF: Strategy / Factory / Builder — реальный backend-пример каждого.**

**[SM] Decorator / Adapter / Proxy — различие и где ты их уже используешь в Spring.**
*Проверяют:* AOP/`@Transactional` — это Proxy; связь с §11.

**[SM] Template Method vs Strategy — наследование vs композиция.**

**[SM] Observer / Pub-Sub — связь с domain events (§38).**

**[SM] Singleton — почему его «не любят» и как Spring-бин это решает.**
*Проверяют:* глобальное состояние, тестируемость; bean-singleton управляется контейнером.

**[S] Антипаттерны: God object, anemic model (§38), over-engineering паттернами.**
*Ловушка:* тащить паттерн, где хватит простой функции.

-----

## 53. OpenTelemetry / трейсинг (углублённо)

**[SM] Что такое OpenTelemetry и зачем он, если трейсинг уже есть?**
*Проверяют:* вендор-нейтральный стандарт для traces/metrics/logs + единая инструментация. *Follow-up:* отвязка приложения от конкретного бэкенда (Jaeger/Tempo/Datadog).

**[SM] Span, trace, context — модель.**
*Проверяют:* trace = дерево спанов; родитель-потомок; атрибуты/события на спане.

**[SM] Auto- vs manual instrumentation; Java agent.**
*Проверяют:* агент инструментирует библиотеки без правки кода; ручные спаны для бизнес-логики.

**[SM] Context propagation между сервисами и через async/потоки.**
*Проверяют:* W3C `traceparent`; *Ловушка:* контекст теряется при переходе в пул потоков/корутину/реактивный пайплайн.

**[S] Sampling: head-based vs tail-based — компромиссы.**
*Проверяют:* head дёшев, но может выкинуть редкие ошибки; tail видит весь трейс, но дороже и сложнее.

**[SM] OpenTelemetry Collector — зачем он?**
*Проверяют:* приём/обработка/экспорт (OTLP), развязка от вендора, батчинг, обогащение, без передеплоя приложения.

**[SM] Semantic conventions — зачем стандартизировать имена атрибутов.**

**[SM] Связь с Micrometer / Micrometer Tracing в Spring Boot 3.**
*Follow-up:* экспорт метрик в Prometheus, трейсов в Tempo/Jaeger.

**[S] Корреляция трейсов, логов и метрик.**
*Проверяют:* `trace_id`/`span_id` в логах (MDC), exemplars в метриках; «один клик от метрики к трейсу к логу». Связь с §26.

-----

## 54. Git

**[M] `merge` vs `rebase` — разница и когда что.**
*Проверяют:* merge сохраняет историю и создаёт merge-commit; rebase переписывает, линеаризует.

**[SM] Почему нельзя ребейзить публичную/расшаренную ветку.**
*Проверяют:* переписывание истории ломает всех, кто на ней основан. *Follow-up:* `--force-with-lease` vs `--force`.

**[SM] Стратегии ветвления: trunk-based vs GitFlow — компромиссы.**
*Проверяют:* частота интеграции, связь с CI/CD и feature flags (§48).

**[SM] `git revert` vs `git reset` — разница и что безопасно в команде.**
*Ловушка:* `reset --hard` на расшаренной ветке.

**[SM] Squash / interactive rebase — чистая история; за и против.**

**[M] `git cherry-pick` — кейс (хотфикс в release-ветку).**

**[SM] `git bisect` — поиск коммита, внёсшего баг.**

**[SM] Что НЕ коммитить и что делать, если секрет уже в истории.**
*Проверяют:* `.gitignore`; секрет в истории = скомпрометирован, нужна ротация + переписывание истории (BFG/filter-repo). Связь с §42.

**[M] PR/MR-воркфлоу, code review, защита веток (required checks).**

-----

## 55. NoSQL (семейства и выбор)

**[SM] Семейства NoSQL: key-value, document, wide-column, graph — что под что.**
*Проверяют:* понимание, что «NoSQL» это не одна вещь, а разные модели под разные задачи.

**[S] Когда NoSQL оправдан вместо РСУБД — и когда это ошибка.**
*Ловушка:* брать NoSQL «для масштаба», когда Postgres справится; терять транзакции и джойны зря. Senior-суждение.

**[SM] Document store (MongoDB) — модель и где ловят.**
*Проверяют:* денормализация, нет полноценных джойнов, границы транзакций, дублирование. *Follow-up:* когда документная модель естественна (агрегат целиком).

**[SM] Wide-column (Cassandra) — query-driven моделирование.**
*Проверяют:* моделируешь под запросы, не под сущности; partition key решает всё; нет ad-hoc запросов. *Ловушка:* реляционное мышление в Cassandra.

**[S] Consistency: eventual vs strong; tunable (quorum R+W>N).**
*Проверяют:* связь с CAP (§23); как настраивается компромисс согласованность/доступность.

**[SM] Денормализация и дублирование как норма в NoSQL.**
*Follow-up:* кто следит за консистентностью дублей (приложение).

**[SM] Schema-on-read vs schema-on-write — последствия.**

**[SM] Идемпотентность и отсутствие уникальных constraint’ов — как обеспечивать уникальность.**

-----

## 56. ClickHouse / OLAP / колоночные БД

**[SM] OLTP vs OLAP — почему для аналитики нужна другая БД.**
*Проверяют:* транзакционная нагрузка (много мелких записей/точечных чтений) vs аналитическая (тяжёлые агрегаты по столбцам).

**[SM] Колоночное хранение — почему быстрее для агрегатов и лучше сжимается.**
*Проверяют:* читаются только нужные колонки; однородные данные в колонке жмутся сильно.

**[S] ClickHouse MergeTree — primary/sorting key, партиции.**
*Проверяют:* сортировка данных на диске, обрезка по партициям, разреженный индекс. *Follow-up:* почему нет привычного «индекса на колонку».

**[SM] Почему ClickHouse плох для частых update/delete и точечных OLTP-запросов.**
*Проверяют:* мутации дорогие/асинхронные; не источник истины для транзакций.

**[SM] Денормализация, широкие таблицы, materialized views в ClickHouse.**

**[S] Доставка данных: вставлять большими батчами, не по одной строке.**
*Ловушка:* построчные INSERT убивают производительность; нужен буфер/батч.

**[S] Eventual consistency между OLTP-БД и ClickHouse.**
*Проверяют:* поток через CDC/Kafka → ClickHouse; аналитика отстаёт. Связь с §20, §46.

**[M] Когда хватает Postgres (partial/BRIN-индексы, §19), а когда нужен ClickHouse.**

-----

## 57. Паттерны алгоритмов: 7 шаблонов с задачами (Java)

Из ~16 типовых шаблонов (sliding window, two pointers, fast & slow, merge intervals, cyclic sort, reverse linked list, tree BFS, tree DFS, two heaps, subsets/backtracking, modified binary search, top-K, k-way merge, topological sort, 0/1 knapsack, bitwise XOR) ниже — 7 самых частых на backend-собесе. Для каждого: суть, сигнал-триггер и три задачи (базовые, но не банальные) с решением на Java.

### 57.1. Два указателя (Two Pointers)
**Суть:** два индекса вместо вложенного цикла — встречное движение с краёв или slow/fast в одну сторону; O(n²) → O(n). **Сигнал:** отсортированный массив, пара/тройка под условие, разворот или дедуп на месте.

**Задача. Пара с суммой `target` в отсортированном массиве — вернуть индексы.**
```java
int[] twoSumSorted(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo < hi) {
        int sum = a[lo] + a[hi];
        if (sum == target) return new int[]{lo, hi};
        if (sum < target) lo++;
        else hi--;
    }
    return new int[]{-1, -1};
}
```

**Задача. Удалить дубли из отсортированного массива на месте, вернуть новую длину.**
```java
int removeDuplicates(int[] a) {
    if (a.length == 0) return 0;
    int write = 1;                          // указатель записи (slow)
    for (int read = 1; read < a.length; read++) {
        if (a[read] != a[write - 1]) a[write++] = a[read];
    }
    return write;
}
```

**Задача. Container With Most Water — макс. площадь между двумя «стенками».**
```java
int maxArea(int[] h) {
    int lo = 0, hi = h.length - 1, best = 0;
    while (lo < hi) {
        best = Math.max(best, Math.min(h[lo], h[hi]) * (hi - lo));
        if (h[lo] < h[hi]) lo++;            // двигаем меньшую сторону
        else hi--;
    }
    return best;
}
```

### 57.2. Скользящее окно (Sliding Window)
**Суть:** поддерживаешь окно `[start, end]` и инкрементально обновляешь агрегат вместо пересчёта; окно растёт вправо и сжимается слева по условию. **Сигнал:** «подмассив/подстрока с условием», «фиксированной длины k», «самый длинный/короткий … подряд».

**Задача. Максимальная сумма подмассива длины k (фиксированное окно).**
```java
int maxSumK(int[] a, int k) {
    int sum = 0;
    for (int i = 0; i < k; i++) sum += a[i];
    int best = sum;
    for (int i = k; i < a.length; i++) {
        sum += a[i] - a[i - k];             // вошёл новый, вышел старый
        best = Math.max(best, sum);
    }
    return best;
}
```

**Задача. Длиннейшая подстрока без повторяющихся символов (переменное окно).**
```java
int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> last = new HashMap<>();
    int start = 0, best = 0;
    for (int end = 0; end < s.length(); end++) {
        char c = s.charAt(end);
        if (last.containsKey(c) && last.get(c) >= start) start = last.get(c) + 1;
        last.put(c, end);
        best = Math.max(best, end - start + 1);
    }
    return best;
}
```

**Задача. Кратчайший подмассив с суммой ≥ target (окно со сжатием).**
```java
int minSubArrayLen(int target, int[] a) {
    int start = 0, sum = 0, best = Integer.MAX_VALUE;
    for (int end = 0; end < a.length; end++) {
        sum += a[end];
        while (sum >= target) {             // сжимаем, пока условие держится
            best = Math.min(best, end - start + 1);
            sum -= a[start++];
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best;
}
```

### 57.3. Хеш-таблица / частотный словарь (Hashing)
**Суть:** разменять память на время — O(1) lookup, счётчик частот, группировка по ключу, префиксные суммы. Самая частая техника на easy/medium. **Сигнал:** «сколько раз», «есть ли пара/дубль», «сгруппируй», «подмассив с суммой».

**Задача. Сколько подмассивов с суммой ровно k (префиксная сумма + map).**
```java
int subarraySum(int[] a, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    count.put(0, 1);                        // пустой префикс
    int prefix = 0, result = 0;
    for (int x : a) {
        prefix += x;
        result += count.getOrDefault(prefix - k, 0);
        count.merge(prefix, 1, Integer::sum);
    }
    return result;
}
```

**Задача. Сгруппировать анаграммы (ключ = отсортированные буквы).**
```java
List<List<String>> groupAnagrams(String[] words) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String w : words) {
        char[] c = w.toCharArray();
        Arrays.sort(c);
        groups.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(w);
    }
    return new ArrayList<>(groups.values());
}
```

**Задача. Индекс первого неповторяющегося символа.**
```java
int firstUniqChar(String s) {
    Map<Character, Integer> freq = new HashMap<>();
    for (char c : s.toCharArray()) freq.merge(c, 1, Integer::sum);
    for (int i = 0; i < s.length(); i++) {
        if (freq.get(s.charAt(i)) == 1) return i;
    }
    return -1;
}
```

### 57.4. Бинарный поиск и его варианты (Binary Search)
**Суть:** на монотонном пространстве отбрасываешь половину за шаг; O(log n). Чаще спрашивают не «найди элемент», а граничный вариант или поиск по ответу. **Сигнал:** отсортировано; «первое/последнее, удовлетворяющее»; «минимальное X, при котором условие истинно». Всегда `mid = lo + (hi - lo) / 2` (защита от overflow).

**Задача. Lower bound — первый индекс, где `a[i] >= target` (точка вставки).**
```java
int lowerBound(int[] a, int target) {
    int lo = 0, hi = a.length;              // полуинтервал [lo, hi)
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
```

**Задача. Поиск в повёрнутом отсортированном массиве.**
```java
int searchRotated(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == target) return mid;
        if (a[lo] <= a[mid]) {              // левая половина отсортирована
            if (a[lo] <= target && target < a[mid]) hi = mid - 1;
            else lo = mid + 1;
        } else {                            // правая половина отсортирована
            if (a[mid] < target && target <= a[hi]) lo = mid + 1;
            else hi = mid - 1;
        }
    }
    return -1;
}
```

**Задача. Целочисленный квадратный корень (поиск по ответу, без `Math.sqrt`).**
```java
int mySqrt(int x) {
    if (x < 2) return x;
    long lo = 1, hi = x;
    while (lo <= hi) {
        long mid = lo + (hi - lo) / 2;
        if (mid * mid <= x) lo = mid + 1;
        else hi = mid - 1;
    }
    return (int) hi;                        // наибольшее mid с mid*mid <= x
}
```

### 57.5. Обход дерева и графа: BFS и DFS
**Суть:** BFS (очередь) идёт по уровням — кратчайший путь в невзвешенном графе; DFS (рекурсия/стек) уходит вглубь — связность, циклы, топосорт. **Сигнал:** дерево/граф/сетка, «по уровням», «компоненты связности», «есть ли путь/цикл», «порядок с зависимостями».
```java
// TreeNode: { int val; TreeNode left, right; }
```

**Задача. Обход дерева по уровням (BFS).**
```java
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> result = new ArrayList<>();
    if (root == null) return result;
    Queue<TreeNode> queue = new LinkedList<>();
    queue.add(root);
    while (!queue.isEmpty()) {
        int size = queue.size();            // фиксируем границу уровня
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.add(node.left);
            if (node.right != null) queue.add(node.right);
        }
        result.add(level);
    }
    return result;
}
```

**Задача. Количество островов в сетке (DFS «затопление»).**
```java
int numIslands(char[][] grid) {
    int count = 0;
    for (int r = 0; r < grid.length; r++)
        for (int c = 0; c < grid[0].length; c++)
            if (grid[r][c] == '1') { count++; sink(grid, r, c); }
    return count;
}
void sink(char[][] g, int r, int c) {
    if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != '1') return;
    g[r][c] = '0';
    sink(g, r + 1, c); sink(g, r - 1, c); sink(g, r, c + 1); sink(g, r, c - 1);
}
```

**Задача. Можно ли пройти все курсы — детект цикла в графе зависимостей (топосорт, алгоритм Кана).**
```java
boolean canFinish(int n, int[][] prerequisites) {
    List<List<Integer>> adj = new ArrayList<>();
    for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
    int[] indegree = new int[n];
    for (int[] p : prerequisites) {          // p[1] -> p[0]
        adj.get(p[1]).add(p[0]);
        indegree[p[0]]++;
    }
    Queue<Integer> queue = new LinkedList<>();
    for (int i = 0; i < n; i++) if (indegree[i] == 0) queue.add(i);
    int visited = 0;
    while (!queue.isEmpty()) {
        int node = queue.poll();
        visited++;
        for (int next : adj.get(node))
            if (--indegree[next] == 0) queue.add(next);
    }
    return visited == n;                      // не все посещены → есть цикл
}
```

### 57.6. Куча / Top-K (Heap)
**Суть:** `PriorityQueue` даёт min/max за O(log n); для «K лучших» держишь кучу размера K → O(n log k) вместо полной сортировки O(n log n). **Сигнал:** «K самых …», «медиана/поток», «слить N отсортированных источников».

**Задача. K-й по величине элемент (min-heap размера k).**
```java
int findKthLargest(int[] a, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();   // min-heap
    for (int x : a) {
        heap.add(x);
        if (heap.size() > k) heap.poll();   // выкидываем наименьший
    }
    return heap.peek();                      // вершина = k-й по величине
}
```

**Задача. K самых частых элементов (частоты + куча).**
```java
List<Integer> topKFrequent(int[] a, int k) {
    Map<Integer, Integer> freq = new HashMap<>();
    for (int x : a) freq.merge(x, 1, Integer::sum);
    PriorityQueue<Map.Entry<Integer, Integer>> heap =
        new PriorityQueue<>(Comparator.comparingInt(Map.Entry::getValue));
    for (var e : freq.entrySet()) {
        heap.add(e);
        if (heap.size() > k) heap.poll();
    }
    List<Integer> result = new ArrayList<>();
    while (!heap.isEmpty()) result.add(heap.poll().getKey());
    return result;
}
```

**Задача. Слить K отсортированных массивов в один (k-way merge).**
```java
int[] mergeSortedArrays(int[][] arrays) {
    // элемент кучи: [значение, индекс массива, индекс в массиве]
    PriorityQueue<int[]> heap = new PriorityQueue<>(Comparator.comparingInt(e -> e[0]));
    int total = 0;
    for (int i = 0; i < arrays.length; i++) {
        if (arrays[i].length > 0) heap.add(new int[]{arrays[i][0], i, 0});
        total += arrays[i].length;
    }
    int[] result = new int[total];
    int idx = 0;
    while (!heap.isEmpty()) {
        int[] top = heap.poll();
        result[idx++] = top[0];
        int ai = top[1], ei = top[2];
        if (ei + 1 < arrays[ai].length) heap.add(new int[]{arrays[ai][ei + 1], ai, ei + 1});
    }
    return result;
}
```

### 57.7. Слияние интервалов (Merge Intervals)
**Суть:** сортируешь по началу, затем линейно сливаешь пересекающиеся. Бэкенд-применение: расписания, брони, диапазоны, дедуп периодов. **Сигнал:** «интервалы/диапазоны/брони», «пересечение», «сколько ресурсов нужно одновременно».

**Задача. Слить все пересекающиеся интервалы.**
```java
int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
    List<int[]> merged = new ArrayList<>();
    for (int[] cur : intervals) {
        int[] last = merged.isEmpty() ? null : merged.get(merged.size() - 1);
        if (last == null || last[1] < cur[0]) merged.add(cur);   // нет пересечения
        else last[1] = Math.max(last[1], cur[1]);                // расширяем
    }
    return merged.toArray(new int[0][]);
}
```

**Задача. Минимум переговорок для всех встреч (хронологический sweep).**
```java
int minMeetingRooms(int[][] intervals) {
    int n = intervals.length;
    int[] starts = new int[n], ends = new int[n];
    for (int i = 0; i < n; i++) { starts[i] = intervals[i][0]; ends[i] = intervals[i][1]; }
    Arrays.sort(starts);
    Arrays.sort(ends);
    int rooms = 0, max = 0, e = 0;
    for (int s = 0; s < n; s++) {
        while (e < n && ends[e] <= starts[s]) { rooms--; e++; }  // комната освободилась
        rooms++;
        max = Math.max(max, rooms);
    }
    return max;
}
```

**Задача. Вставить новый интервал в отсортированный список без пересечений и слить.**
```java
int[][] insert(int[][] intervals, int[] newInterval) {
    List<int[]> result = new ArrayList<>();
    int i = 0, n = intervals.length;
    while (i < n && intervals[i][1] < newInterval[0]) result.add(intervals[i++]);   // до
    while (i < n && intervals[i][0] <= newInterval[1]) {                            // пересечение
        newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
        newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
        i++;
    }
    result.add(newInterval);
    while (i < n) result.add(intervals[i++]);                                       // после
    return result.toArray(new int[0][]);
}
```

-----

## 58. SQL-практикум: 20 запросов с фичами (PostgreSQL)

Схема для всех примеров:
```sql
-- departments(id, name)
-- employees(id, name, department_id, salary, manager_id, hired_at)
-- customers(id, name, country, created_at)
-- orders(id, customer_id, amount, status, created_at)
-- products(id, name, category, price)
-- order_items(order_id, product_id, quantity)
```

**1. Вторая по величине зарплата (скалярный подзапрос).**
```sql
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
-- вариант: SELECT DISTINCT salary FROM employees ORDER BY salary DESC OFFSET 1 LIMIT 1;
```

**2. N-я по величине зарплата — здесь 3-я (оконный ранкинг).**
```sql
SELECT salary
FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees) t
WHERE rnk = 3;
-- ROW_NUMBER: уникальный № (дубли получат разные); RANK: с пропусками (1,1,3);
-- DENSE_RANK: без пропусков (1,1,2).
```

**3. Сотрудник с максимальной зарплатой в каждом отделе (PARTITION BY).**
```sql
SELECT department_id, name, salary
FROM (
  SELECT department_id, name, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
  FROM employees
) t
WHERE rn = 1;
```

**4. Нарастающий итог по заказам (кумулятивное окно).**
```sql
SELECT id, created_at, amount,
       SUM(amount) OVER (ORDER BY created_at) AS running_total
FROM orders;
```

**5. Скользящее среднее по последним 3 заказам (рамка окна).**
```sql
SELECT id, created_at, amount,
       AVG(amount) OVER (ORDER BY created_at
                         ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg
FROM orders;
```

**6. Изменение выручки месяц к месяцу (LAG).**
```sql
SELECT month, revenue, revenue - LAG(revenue) OVER (ORDER BY month) AS delta
FROM (
  SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS revenue
  FROM orders
  GROUP BY 1
) m
ORDER BY month;
```

**7. Сотрудник и имя его руководителя (self-join).**
```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;   -- LEFT: топ-менеджер без руководителя тоже виден
```

**8. Найти дублирующиеся имена (GROUP BY + HAVING).**
```sql
SELECT name, COUNT(*) AS cnt
FROM employees
GROUP BY name
HAVING COUNT(*) > 1;
```

**9. Удалить дубли, оставив строку с минимальным id (CTE + DELETE USING).**
```sql
DELETE FROM employees e
USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
  FROM employees
) d
WHERE e.id = d.id AND d.rn > 1;
```

**10. Сотрудники с зарплатой выше средней по своему отделу (коррелированный подзапрос).**
```sql
SELECT e.name, e.department_id, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(salary) FROM employees x WHERE x.department_id = e.department_id);
-- оконную AVG(...) OVER (PARTITION BY ...) нельзя класть в WHERE — окна считаются ПОСЛЕ WHERE,
-- нужно заворачивать в подзапрос.
```

**11. Клиенты без заказов (анти-джойн).**
```sql
SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
-- эквивалент: WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**12. Кол-во заказов по статусам в одной строке (pivot через FILTER).**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'NEW')       AS new_cnt,
  COUNT(*) FILTER (WHERE status = 'PAID')      AS paid_cnt,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_cnt
FROM orders;
```

**13. Выручка по месяцам (DATE_TRUNC + агрегат).**
```sql
SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS revenue
FROM orders
GROUP BY 1
ORDER BY 1;
```

**14. Распределение сотрудников по зарплатным вилкам (CASE-бакетинг).**
```sql
SELECT
  CASE WHEN salary < 50000  THEN 'low'
       WHEN salary < 100000 THEN 'mid'
       ELSE 'high' END AS band,
  COUNT(*) AS cnt
FROM employees
GROUP BY 1
ORDER BY 1;
```

**15. Медианная зарплата по отделам (PERCENTILE_CONT).**
```sql
SELECT department_id,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary
FROM employees
GROUP BY department_id;
```

**16. Имена сотрудников через запятую по отделам (STRING_AGG).**
```sql
SELECT department_id, STRING_AGG(name, ', ' ORDER BY name) AS employees
FROM employees
GROUP BY department_id;
```

**17. Первый заказ каждого клиента (DISTINCT ON — фишка PG).**
```sql
SELECT DISTINCT ON (customer_id) customer_id, id, created_at, amount
FROM orders
ORDER BY customer_id, created_at;   -- DISTINCT ON требует ORDER BY с тем же ведущим ключом
```

**18. Клиенты, купившие товар 'Laptop' (EXISTS / semi-join).**
```sql
SELECT c.id, c.name
FROM customers c
WHERE EXISTS (
  SELECT 1
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p     ON p.id = oi.product_id
  WHERE o.customer_id = c.id AND p.name = 'Laptop'
);
-- Ловушка: NOT IN с подзапросом, где встречается NULL, вернёт пусто. Для отрицания — NOT EXISTS.
```

**19. Иерархия подчинённых руководителя (рекурсивный CTE).**
```sql
WITH RECURSIVE subordinates AS (
  SELECT id, name, manager_id, 1 AS level
  FROM employees
  WHERE id = 1                                  -- стартовый руководитель
  UNION ALL
  SELECT e.id, e.name, e.manager_id, s.level + 1
  FROM employees e
  JOIN subordinates s ON e.manager_id = s.id
)
SELECT * FROM subordinates;
```

**20. UPSERT — вставить или обновить при конфликте (ON CONFLICT).**
```sql
INSERT INTO products (id, name, category, price)
VALUES (10, 'Laptop', 'Electronics', 1200)
ON CONFLICT (id) DO UPDATE
SET price = EXCLUDED.price,
    name  = EXCLUDED.name;
```

-----

## 59. База по темам вне основной карты

Минимум по блокам, которых не было в §1–56 (batch, шедулинг, real-time, потоковая обработка, крипто/защита данных, деньги). Только база — без senior-погружения.

### Batch / bulk-обработка
**[M] Чем пакетная обработка отличается от обработки запроса; зачем chunk-ориентированность.**
*Проверяют:* оптимизация throughput, а не latency; данные, не влезающие в память, идут порциями (read → process → write по N строк). *Связь:* Spring Batch — Job/Step/Chunk, ItemReader/Processor/Writer.

**[M] Как пройти таблицу в миллионы строк, не убив память и БД.**
*Проверяют:* keyset/cursor-пагинация батчами, стрим вместо загрузки в `List`. *Ловушка:* `OFFSET` на глубоких страницах (медленно, связь с §13).

**[SM] Идемпотентность и перезапуск джобы с середины.**
*Проверяют:* checkpoint/restart, повторный прогон не задваивает эффекты. *Ловушка:* не сохранять прогресс → рестарт с нуля или дубли.

**[SM] Бэкфилл/миграция данных на проде без даунтайма.**
*Проверяют:* throttling, возобновляемость, обратная совместимость, не держать длинные блокировки (связь с §27).

### Распределённый шедулинг
**[M] `@Scheduled` на нескольких инстансах — что произойдёт.**
*Проверяют:* задача выполнится на КАЖДОМ инстансе (дубли). *Ловушка:* думать, что Spring сам дедуплицирует.

**[SM] Как обеспечить единственный запуск в кластере.**
*Проверяют:* распределённый лок (ShedLock), выбор лидера или блокировка-строка в БД.

**[M] Cron: таймзона, пропуски, перекрытие запусков.**
*Проверяют:* что будет, если предыдущий запуск ещё идёт; в какой TZ считается расписание (связь с §35).

**[SM] At-least-once исполнение и идемпотентность задач.**
*Проверяют:* пропущенный/повторный запуск; очередь задач на БД со `SKIP LOCKED` vs брокер (связь с §18, §24).

### Real-time: WebSocket / SSE
**[M] WebSocket vs SSE vs long-polling — когда что.**
*Проверяют:* WS двусторонний; SSE односторонний (server→client, дёшев); polling как fallback.

**[SM] Почему масштабировать WebSocket трудно.**
*Проверяют:* соединения stateful и привязаны к инстансу; нужен sticky-роутинг или общий брокер для fan-out (связь с §21 pub/sub).

**[M] Как доставить сообщение пользователю на другом инстансе.**
*Проверяют:* shared message bus (Redis pub/sub, Kafka), а не локальная память процесса.

**[SM] Backpressure и медленный клиент.**
*Проверяют:* ограниченные буферы, отключать отстающих; не копить неотправленное в памяти (связь с §27).

### Stream processing (Kafka Streams)
**[M] Чем потоковая обработка отличается от обычного consumer'а.**
*Проверяют:* непрерывные трансформации с состоянием и окнами, а не «забрал → обработал → закоммитил offset».

**[SM] KStream vs KTable.**
*Проверяют:* поток событий vs таблица-снапшот (последнее значение по ключу), changelog между ними.

**[M] Оконные агрегации — зачем окна.**
*Проверяют:* tumbling/sliding/session; агрегаты по времени (счётчики за минуту, скользящие суммы).

**[SM] Состояние и отказоустойчивость.**
*Проверяют:* state store + changelog-топик для восстановления; exactly-once в топологии (связь с §20).

### Прикладная криптография / защита данных
**[M] Хеширование vs шифрование vs подпись — что для чего.**
*Проверяют:* хеш необратим (пароли, целостность), шифрование обратимо (секреты), подпись = аутентичность + целостность. *Ловушка:* «зашифровать пароль» вместо хеширования.

**[M] Симметричное vs асимметричное шифрование.**
*Проверяют:* один общий ключ (AES, быстро) vs пара ключей (RSA/ECC — обмен ключами, подпись).

**[SM] Encryption at rest vs in transit.**
*Проверяют:* TLS на проводе (§33) vs шифрование диска/колонок в покое; где проходят границы доверия.

**[SM] Хранение и ротация ключей; токенизация/маскирование PII.**
*Проверяют:* KMS/Vault, ключи не в коде/гите (§12, §42); токенизация номеров карт, маскирование PII в логах (§26). *Пароли:* bcrypt/argon2 + соль — см. §14.

### Деньги и точные вычисления
**[M] Почему нельзя `double`/`float` для денег.**
*Проверяют:* двоичная плавающая точка не представляет `0.1` точно → ошибки округления. *Ловушка:* `0.1 + 0.2 != 0.3`.

**[M] `BigDecimal` — как правильно.**
*Проверяют:* создавать из строки (`new BigDecimal("0.1")`), не из `double`; задавать `scale` и `RoundingMode` при делении; сравнивать через `compareTo`, а не `equals` (`2.0` ≠ `2.00` по `equals`, но равны по `compareTo`).

**[SM] Как хранить деньги в БД.**
*Проверяют:* `NUMERIC/DECIMAL` с фиксированным масштабом либо целое в минорных единицах (центы); никогда `float`.

**[SM] Валюта и округление.**
*Проверяют:* хранить валюту рядом с суммой; округлять по правилам валюты и на каждом шаге, а не в конце.

-----

## Как пользоваться банком

- Не читай пассивно. Закрой аннотацию, ответь вслух, потом сверься.
- На каждый вопрос форсируй follow-up: «почему?», «что под нагрузкой?», «что если два инстанса?», «что если транзакция откатится?» — именно второй вопрос решает исход.
- System design (§24) и senior-темы надёжности (§15, §22, §23, §27) весят больше всего для strong middle / senior; синтаксическая мелочь — меньше всего.
- Триаж по слабым местам лучше линейного чтения: пробегись сначала по senior-вопросам каждого блока; где не можешь дать follow-up — это твой приоритет.