# О дублировании кода: четыре грани одной проблемы (с примерами)

---

## I. Текст — не знание

DRY придумали не как «запрет на одинаковые строки кода». Исходная формулировка из *The Pragmatic Programmer* звучит так:

> «Каждый фрагмент знания должен иметь единственное, непротиворечивое, авторитетное представление в системе».

Ключевое слово здесь — **знание**, а не «кусок текста».

Посмотрим на совсем простой код.

```java
// Где-то в CheckoutService
if (user.isEmailVerified()) {
    allowPurchase();
}

// Где-то в SubscriptionService
if (user.isEmailVerified()) {
    startSubscription();
}
```

Здесь, с высокой вероятностью, одно и то же правило: «к платным действиям допускаем только верифицированных пользователей». Если завтра бизнес скажет: «теперь верификация не обязательна», эти два места должны меняться синхронно. Это один кусок знания, размазанный по системе.

А теперь другой пример — визуально похожий, но по смыслу другой.

```java
// Бесплатная доставка
boolean eligibleForFreeShipping(Order order) {
    return order.getTotal() >= 1000;
}

// Рассрочка
boolean eligibleForInstallment(Order order) {
    return order.getTotal() >= 1000;
}
```

Код одинаковый. Но за ним стоят разные решения:

* порог для бесплатной доставки — кейс маркетинга;
* порог для рассрочки — кейс риска и финансов.

Сегодня это «одно и то же число», завтра маркетинг скажет: «доставку делаем с 500», а риск-отдел — «рассрочку только от 2000». Если ты заранее сделал:

```java
boolean hasEnoughAmountForBenefits(Order order) {
    return order.getTotal() >= 1000;
}
```

— ты связал две независимые оси изменений. Формально DRY соблюдён, по смыслу — нет.

Отсюда первый вывод: **дублирование текста само по себе не преступление**. Важно, дублируешь ли ты одно и то же **правило**, которое должно меняться в унисон, или просто два разных решения, которые случайно стартанули с одинаковой формулы.

---

## II. Одна причина меняться — один источник правды

Теперь пример, где DRY действительно обязателен.

Представим, что где-то в коде жёстко зашита ставка НДС, и используется она в нескольких местах:

```java
// В контроллере
BigDecimal vatForUi(BigDecimal price) {
    return price.multiply(new BigDecimal("0.20"));
}

// В биллинге
BigDecimal vatForInvoice(BigDecimal price) {
    return price.multiply(new BigDecimal("0.20"));
}

// В отчётах
BigDecimal vatForReport(BigDecimal price) {
    return price.multiply(new BigDecimal("0.20"));
}
```

Формула одна и та же, и здесь это **реально одно знание**: ставка налога, установленная законом. Владелец один (государство), причина изменения одна (изменение законодательства), и любое расхождение между местами будет багом.

Это тот случай, где просится единый центр тяжести:

```java
public final class TaxCalculator {

    private static final BigDecimal VAT_RATE = new BigDecimal("0.20");

    private TaxCalculator() {}

    public static BigDecimal calculateVat(BigDecimal amount) {
        return amount.multiply(VAT_RATE);
    }
}
```

Дальше в коде:

```java
BigDecimal vatForUi(BigDecimal price) {
    return TaxCalculator.calculateVat(price);
}

BigDecimal vatForInvoice(BigDecimal price) {
    return TaxCalculator.calculateVat(price);
}

BigDecimal vatForReport(BigDecimal price) {
    return TaxCalculator.calculateVat(price);
}
```

Если завтра ставка станет 21%, ты меняешь её в одном месте. Не нужно вспоминать, где ещё ты множил на `0.20`. Это и есть «один авторитетный источник знания».

Практический критерий: если у фрагмента кода **одна причина меняться**, и эта причина одновременно затрагивает несколько мест, — имеет смысл собрать логику в единый модуль/метод.

---

## III. Дублирование дешевле неправильной абстракции

Теперь другая сторона медали. Сэнди Метц сформулировала это так:

> «Duplication is far cheaper than the wrong abstraction».

Объединяя похожий код, ты создаёшь абстракцию — утверждаешь «это по сути одно и то же». Если это утверждение неверно, абстракция начинает мешать.

Возьмём пример с master/replica для базы:

```java
DataSource masterDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(masterUrl);
    config.setMaximumPoolSize(5);
    config.setConnectionTimeout(5000);
    return new HikariDataSource(config);
}

DataSource replicaDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(replicaUrl);
    config.setMaximumPoolSize(20);
    config.setConnectionTimeout(1000);
    config.setReadOnly(true);
    return new HikariDataSource(config);
}
```

Код на 80% одинаковый. Инстинкт: «надо заDRYить».

```java
DataSource createDataSource(String type) {
    HikariConfig config = new HikariConfig();

    if (type.equals("master")) {
        config.setJdbcUrl(masterUrl);
        config.setMaximumPoolSize(5);
        config.setConnectionTimeout(5000);
    } else if (type.equals("replica")) {
        config.setJdbcUrl(replicaUrl);
        config.setMaximumPoolSize(20);
        config.setConnectionTimeout(1000);
        config.setReadOnly(true);
    } else {
        throw new IllegalArgumentException("Unknown type: " + type);
    }

    return new HikariDataSource(config);
}
```

Формально — дублирование исчезло. Фактически — появился метод, который делает две разных вещи по строковому флагу, и связал между собой конфиги master и replica.

Через полгода требований станет больше:

```java
// для master нужно validationQuery,
// для replica — несколько адресов для load balancing,
// плюс отдельные тайм-ауты на подкл/чтение и т.д.
```

У тебя либо растёт зоопарк `if (type.equals(...))`, либо появляются флаги `boolean readOnly`, `boolean useLoadBalancing`, и метод превращается в комбинаторный ад.

Две отдельные функции с небольшим дублированием текста оказываются **проще и честнее**, чем один «универсальный» фабричный метод:

```java
DataSource masterDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(masterUrl);
    config.setMaximumPoolSize(5);
    config.setConnectionTimeout(5000);
    config.setConnectionTestQuery("SELECT 1");
    return new HikariDataSource(config);
}

DataSource replicaDataSource() {
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(replicaUrl);
    config.setMaximumPoolSize(20);
    config.setConnectionTimeout(1000);
    config.setReadOnly(true);
    config.setDataSourceProperties(replicaLoadBalancingProps());
    return new HikariDataSource(config);
}
```

Да, часть строк повторяется. Но:

* каждая функция описывает цельный, осмысленный объект;
* поведение master и replica не сцеплено строковым параметром;
* изменения в одной ветке не рискуют «поехать» через общую абстракцию.

Ключевой тест: **будут ли эти куски кода эволюционировать вместе?**

* если да — есть смысл в общей абстракции;
* если нет — честные дубликаты зачастую дешевле, чем общий метод с флагами и условностями.

---

## IV. Дублирование как архитектурный инструмент

На уровне архитектуры иногда имеет смысл **специально оставить дублирование**, чтобы не создавать лишнюю связность.

Классика — микросервисы. Представим два сервиса: `Orders` и `Payments`.

Наивный подход:

```java
// common-models.jar
public class UserInfo {
    private String id;
    private String email;
    private String name;
}
```

Оба сервиса тянут одну и ту же модель из общей библиотеки. DRY соблюдён, “один источник истины”.

Альтернатива — каждый сервис держит свою модель:

```java
// В сервисе Orders
public class OrderUserInfo {
    private String id;
    private String email;
    private String name;
    // например, поля для доставки
}

// В сервисе Payments
public class PaymentUserInfo {
    private String id;
    private String email;
    private String name;
    // например, поля для биллинга
}
```

Да, тут есть дублирование полей и, возможно, даже маппинга из одного в другое. Но посмотри, что ты выигрываешь:

* **независимые релизы**. Команда Orders может добавить поле `shippingAddress` и выкатывать свой сервис, не трогая Payments;
* **независимые модели**. Payments могут добавить `billingCountry` и не тянуть это в Orders;
* **меньше связности**. Баг в одной модели не валит все сервисы через общую `common-models`.

Общая библиотека выглядит как «правильный DRY», но практически становится точкой жёсткой связи команд и сервисов. Две локальные модели — намеренное дублирование, которое покупает изоляцию.

В терминах DDD это и есть разные bounded context’ы: `User` в контексте заказов и `User` в контексте платежей — **не одно и то же знание**, даже если часть полей совпадает.

---

## Вместо вывода: четыре вопроса к любому дубликату

Когда ты видишь похожий код, нормальная реакция сеньора — не «как бы это заDRYить», а «что именно здесь повторяется».

Полезно задать себе четыре вопроса:

1. **Что именно повторяется: текст или знание?**
   Совпадение литералов и формул ещё не означает, что это одно и то же правило.

2. **Есть ли одна причина меняться?**
   Если изменение требований обязано одинаково затронуть все эти места — нужен общий центр тяжести (как с НДС).

3. **Будут ли эти места эволюционировать вместе?**
   Если у них разные оси изменений, честные дубликаты часто дешевле, чем “универсальный” метод с флагами.

4. **Не ломаю ли я изоляцию общей абстракцией?**
   Общий код между независимыми сервисами/командами — это не только DRY, но и зависимость. Иногда две копии одной структуры лучше, чем один общий модуль.

DRY в зрелом понимании — это не «запрещено дважды написать `if`». Это требование: у каждого **важного правила** в системе должен быть один осмысленный центр правды. Всё остальное — вопрос баланса между читабельностью, изоляцией и ценой ошибок.


