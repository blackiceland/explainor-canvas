# 🛠️ Технологический стек (детальное описание)

## 📋 Оглавление
1. [Backend Stack](#backend-stack)
2. [Frontend Stack](#frontend-stack)
3. [Infrastructure](#infrastructure)
4. [Поэтапное внедрение](#поэтапное-внедрение)

---

## ☕ Backend Stack

### **1. Java 21 + Spring Boot 3.x**
**Роль:** Основной backend, REST API, бизнес-логика

**Почему выбран:**
- ✅ Зрелая экосистема (Dependency Injection, Security, Testing)
- ✅ Масштабируемость (микросервисы, Kubernetes)
- ✅ Твой опыт (Java + Spring Boot)
- ✅ Enterprise-ready (транзакции, мониторинг, логирование)

**Что делает:**
- REST API для генерации Scene IR
- Валидация JSON (схема + миграции версий)
- SceneFactory (генерация сцен динамически)
- Управление рендер-очередью (Phase 4)

**Альтернативы рассмотрены:**
- Node.js + Express (быстрее для MVP, но хуже для enterprise)
- FastAPI (Python) — проще, но меньше инструментов

---

### **2. PostgreSQL** 🗄️
**Роль:** Основная БД для хранения Scene IR, пользователей, проектов

**Почему выбран:**
- ✅ **JSONB** — нативная поддержка JSON (Scene IR хранится как JSONB)
- ✅ **Транзакции** — ACID гарантии для версионирования
- ✅ **Индексы на JSONB** — быстрый поиск по свойствам сцен
- ✅ **Зрелость** — стабильная, хорошо документированная

**Что хранит:**
```sql
-- Таблица сцен
CREATE TABLE scenes (
  scene_id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  scene_data JSONB NOT NULL,      -- Scene IR (JSON)
  version VARCHAR(50) NOT NULL,    -- версия схемы (1.0, 1.1, ...)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для быстрого поиска
CREATE INDEX idx_scene_data ON scenes USING GIN (scene_data);

-- Таблица пользователей
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  quota_minutes INT DEFAULT 10,   -- минуты рендера
  created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица проектов
CREATE TABLE projects (
  project_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  name VARCHAR(255) NOT NULL,
  scenes UUID[] DEFAULT '{}',     -- массив scene_id
  created_at TIMESTAMP DEFAULT NOW()
);

-- История версий (для rollback)
CREATE TABLE scene_history (
  history_id UUID PRIMARY KEY,
  scene_id UUID REFERENCES scenes(scene_id),
  scene_data JSONB NOT NULL,
  version VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

**Когда добавлять:** **Week 11-12 (Phase 3)** — когда JSON-driven сцены готовы.

**Альтернативы рассмотрены:**
- MongoDB (NoSQL) — хуже для транзакций
- MySQL — нет нативного JSONB

---

### **3. Redis** 🔴
**Роль:** Очередь рендера, кэш, rate limiting

**Почему выбран:**
- ✅ **In-memory** — быстрый доступ (кэш видео)
- ✅ **Pub/Sub** — распределение задач между воркерами
- ✅ **TTL** — автоматическое удаление старого кэша
- ✅ **Atomic operations** — счётчики, rate limiting

**Что делает:**

#### **A. Render Queue (очередь задач)**
```java
// Backend: добавляем задачу в очередь
@Service
public class RenderService {
    
    @Autowired
    private RedisTemplate<String, String> redis;
    
    public String enqueueRenderJob(Scene scene) {
        String jobId = UUID.randomUUID().toString();
        
        RenderJob job = new RenderJob(jobId, scene);
        redis.opsForList().rightPush("render:queue", job.toJSON());
        
        return jobId;
    }
}
```

```javascript
// Worker: читаем задачу из очереди
const redis = require('redis');
const client = redis.createClient();

async function processQueue() {
  while (true) {
    const job = await client.blPop('render:queue', 0);  // блокирующее чтение
    await renderScene(JSON.parse(job));
  }
}
```

#### **B. Scene Cache (кэш видео по хэшу)**
```java
// Проверяем кэш перед рендером
public Optional<String> getCachedVideo(Scene scene) {
    String cacheKey = "video:" + computeHash(scene);
    return Optional.ofNullable(redis.opsForValue().get(cacheKey));
}

// Сохраняем видео в кэш
public void cacheVideo(Scene scene, String videoUrl) {
    String cacheKey = "video:" + computeHash(scene);
    redis.opsForValue().set(cacheKey, videoUrl, Duration.ofDays(30));  // TTL 30 дней
}
```

#### **C. Rate Limiting (ограничение запросов)**
```java
// Пользователь может запросить не более 10 рендеров в час
public boolean checkRateLimit(String userId) {
    String key = "rate_limit:" + userId;
    Long count = redis.opsForValue().increment(key);
    
    if (count == 1) {
        redis.expire(key, Duration.ofHours(1));  // сбросится через час
    }
    
    return count <= 10;
}
```

**Структура данных:**
```
Redis Keys:
  render:queue         (List)     → очередь задач
  video:{hash}         (String)   → URL видео (кэш)
  rate_limit:{userId}  (Counter)  → кол-во запросов в час
  job:{jobId}          (Hash)     → статус задачи (PENDING/RENDERING/COMPLETE)
```

**Когда добавлять:** **Week 21-22 (Phase 4)** — когда рендер-ферма готова.

**Альтернативы рассмотрены:**
- RabbitMQ (AMQP) — сложнее для простых очередей
- SQS (AWS) — vendor lock-in

---

### **4. MinIO (S3-compatible storage)** ☁️
**Роль:** Хранение видео, PNG-кадров, аудио-файлов

**Почему выбран:**
- ✅ **S3-compatible API** — легко мигрировать на AWS S3
- ✅ **Self-hosted** — не нужен AWS на старте (дешевле)
- ✅ **High performance** — erasure coding, multi-part upload

**Что хранит:**
```
Bucket: videos/
  └── {scene_id}/
      ├── output.mp4        (финальное видео)
      ├── frames/           (PNG-кадры)
      │   ├── frame_0001.png
      │   ├── frame_0002.png
      │   └── ...
      └── audio.mp3         (аудио-дорожка)

Bucket: projects/
  └── {project_id}/
      └── assets/           (логотипы, шрифты)
```

**Интеграция с Spring Boot:**
```java
@Service
public class VideoStorageService {
    
    @Autowired
    private MinioClient minioClient;
    
    public String uploadVideo(String sceneId, InputStream video) {
        String objectName = sceneId + "/output.mp4";
        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket("videos")
                .object(objectName)
                .stream(video, -1, 10485760)  // 10MB part size
                .build()
        );
        
        return getPublicUrl("videos", objectName);
    }
}
```

**Когда добавлять:** **Week 21-22 (Phase 4)** — одновременно с рендер-фермой.

**Альтернативы рассмотрены:**
- AWS S3 — дороже, но проще для production
- Google Cloud Storage — vendor lock-in
- Локальная ФС — не масштабируется

---

## 🎨 Frontend Stack

### **1. Motion Canvas** 🎬
**Роль:** Декларативные анимации, сцены, экспорт PNG-последовательностей

**Почему выбран:**
- ✅ **TypeScript-first** — типизация из коробки
- ✅ **Declarative API** — читаемый код (`<Rect>`, `<Circle>`)
- ✅ **Signals (реактивность)** — авто-обновление при изменениях
- ✅ **Экспорт видео** — PNG-последовательности → FFmpeg → MP4
- ✅ **Активное комьюнити** — регулярные обновления

**Что делает:**
- Рендер анимаций (компоненты → кадры)
- Экспорт PNG-последовательностей (frame_0001.png, frame_0002.png, ...)
- Preview в браузере (Hot Module Replacement)

**Пример:**
```typescript
export default makeScene2D(function* (view) {
  const topic = <KafkaTopic x={0} y={0} name="events" />;
  view.add(topic);
  yield* topic.appear(0.5);
});
```

**Альтернативы рассмотрены:**
- Remotion (React) — хуже для 2.5D, нет Signal-реактивности
- Manim (Python) — сложнее, нет веб-превью
- After Effects — не программируется

---

### **2. Rapier 2D** ⚙️
**Роль:** Физический движок (гравитация, столкновения) для baked physics

**Почему выбран:**
- ✅ **Детерминизм** — одинаковый результат при одинаковом seed (критично для видео)
- ✅ **Производительность** — Rust/WASM (быстрее JavaScript)
- ✅ **Стабильность** — меньше багов, чем Matter.js

**Как используется:**
1. **Оффлайн симуляция** (отдельный скрипт):
   ```typescript
   // simulate-domino.ts
   const world = new RAPIER.World({ x: 0, y: 9.81 });
   
   // Добавляем домино
   const domino = world.createRigidBody(...);
   
   // Симулируем 5 секунд
   const keyframes = [];
   for (let t = 0; t < 5; t += 0.016) {  // 60 FPS
     world.step();
     keyframes.push({
       time: t,
       position: domino.translation(),
       rotation: domino.rotation(),
     });
   }
   
   // Сохраняем в JSON
   fs.writeFileSync('domino-physics.json', JSON.stringify(keyframes));
   ```

2. **Motion Canvas проигрывает keyframes** (рендер):
   ```typescript
   const keyframes = yield fetch('/api/physics/domino-fall');
   
   for (const kf of keyframes) {
     domino.position(kf.position);
     domino.rotation(kf.rotation);
     yield* waitFor(0.016);  // 60 FPS
   }
   ```

**Когда добавлять:** **Week 4 (Phase 1)** — только baked physics (никакой live physics в v1).

**Альтернативы рассмотрены:**
- Matter.js — проще, но медленнее и недетерминирован
- Box2D — старый, хуже документация
- Fake physics (keyframes) — достаточно для 80% случаев

---

### **3. TypeScript** 📘
**Роль:** Типизация, IDE tooling, рефакторинг

**Почему обязателен:**
- ✅ **Type safety** — ошибки на этапе компиляции
- ✅ **Autocomplete** — IDE подсказывает методы/свойства
- ✅ **Refactoring** — переименование переменных/классов безопасно
- ✅ **Масштабируемость** — большие кодбазы остаются управляемыми

**Настройка (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "strict": true,                  // строгая типизация
    "noImplicitAny": true,          // запрет `any`
    "strictNullChecks": true,       // null-safety
    "esModuleInterop": true,
    "jsx": "preserve",               // Motion Canvas JSX
    "jsxImportSource": "@motion-canvas/2d/lib"
  }
}
```

**Альтернативы:** Нет (JavaScript без типов = боль).

---

### **4. FFmpeg** 🎥
**Роль:** Сборка PNG → MP4, audio-sync, compression, мультиформатный экспорт

**Почему выбран:**
- ✅ **Стандарт индустрии** — используется везде (YouTube, Netflix)
- ✅ **Мультиформатность** — MP4, WebM, GIF, PNG, SVG
- ✅ **Audio-sync** — точная синхронизация аудио/видео
- ✅ **Compression** — H.264, H.265 кодеки

**Что делает:**

#### **A. Сборка PNG → MP4**
```bash
# Motion Canvas экспортирует PNG-кадры:
# frame_0001.png, frame_0002.png, ..., frame_0300.png (5 секунд @ 60 FPS)

# FFmpeg собирает в видео:
ffmpeg -framerate 60 \
       -i frame_%04d.png \
       -c:v libx264 \
       -pix_fmt yuv420p \
       -crf 18 \
       output.mp4

# Результат: output.mp4 (5 секунд, 60 FPS, высокое качество)
```

#### **B. Audio-sync (синхронизация с аудио)**
```bash
# Добавляем аудио-дорожку:
ffmpeg -i output.mp4 \
       -i narration.mp3 \
       -c:v copy \
       -c:a aac \
       -shortest \
       output_with_audio.mp4

# Результат: видео + аудио синхронизированы
```

#### **C. Мультиформатный экспорт**
```bash
# MP4 (для YouTube)
ffmpeg -i frames/%04d.png -c:v libx264 -crf 18 output.mp4

# WebM (для веб)
ffmpeg -i frames/%04d.png -c:v libvpx-vp9 output.webm

# GIF (для превью)
ffmpeg -i frames/%04d.png -vf "fps=30,scale=640:-1" output.gif

# PNG (один кадр, thumbnail)
ffmpeg -i frames/frame_0001.png thumbnail.png
```

#### **D. Compression (сжатие для экономии места)**
```bash
# Высокое качество (CRF 18, ~20-30 Mbps)
ffmpeg -i input.mp4 -c:v libx264 -crf 18 output_high.mp4

# Среднее качество (CRF 23, ~5-10 Mbps) — оптимально
ffmpeg -i input.mp4 -c:v libx264 -crf 23 output_medium.mp4

# Низкое качество (CRF 28, ~2-4 Mbps)
ffmpeg -i input.mp4 -c:v libx264 -crf 28 output_low.mp4
```

**Интеграция с Worker (Node.js):**
```javascript
const ffmpeg = require('fluent-ffmpeg');

async function renderVideo(framesDir, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`${framesDir}/frame_%04d.png`)
      .inputFPS(60)
      .input(audioPath)
      .outputOptions('-c:v libx264')
      .outputOptions('-pix_fmt yuv420p')
      .outputOptions('-crf 23')
      .outputOptions('-c:a aac')
      .outputOptions('-shortest')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}
```

**Когда использовать:** **Week 1 (Phase 1)** — нужен уже для первого видео.

**Альтернативы рассмотрены:**
- HandBrake — GUI-only (нет API)
- Codec libraries (x264, libvpx) — слишком низкоуровневые

---

## 🐳 Infrastructure

### **1. Docker + Docker Compose** 🐳
**Роль:** Изолированные контейнеры для backend, frontend, воркеров

**Почему выбран:**
- ✅ **Изоляция** — каждый сервис в своём окружении
- ✅ **Масштабируемость** — `docker-compose scale worker=5`
- ✅ **CI/CD готовность** — легко деплоить

**Архитектура:**
```yaml
services:
  backend:
    build: .
    ports: ["8081:8081"]
    depends_on: [postgres, redis]
    
  postgres:
    image: postgres:16
    volumes: ["postgres-data:/var/lib/postgresql/data"]
    
  redis:
    image: redis:7
    
  motioncanvas:
    build: ./motion-canvas
    ports: ["5173:5173"]
    volumes: ["./motion-canvas:/app"]  # HMR
    
  worker:
    build: ./render-worker
    depends_on: [redis, minio]
    deploy:
      replicas: 3  # 3 воркера параллельно
      
  minio:
    image: minio/minio
    ports: ["9000:9000"]
    volumes: ["minio-data:/data"]
```

---

### **2. Kubernetes (Phase 4, Production)** ☸️
**Роль:** Оркестрация в production, автоматическое масштабирование

**Когда добавлять:** **Week 24+ (Phase 4+)** — только для production.

**Преимущества:**
- ✅ **Auto-scaling** — добавляет воркеры при нагрузке
- ✅ **Health checks** — перезапускает упавшие контейнеры
- ✅ **Load balancing** — распределяет трафик

---

## 📅 Поэтапное внедрение

| Технология | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------------|---------|---------|---------|---------|
| **Motion Canvas** | ✅ Week 1 | ✅ | ✅ | ✅ |
| **TypeScript** | ✅ Week 1 | ✅ | ✅ | ✅ |
| **Spring Boot** | ✅ Week 1 | ✅ | ✅ | ✅ |
| **FFmpeg** | ✅ Week 1 | ✅ | ✅ | ✅ |
| **Docker** | ✅ Week 1 | ✅ | ✅ | ✅ |
| **Rapier 2D** | ✅ Week 4 | ✅ | ✅ | ✅ |
| **PostgreSQL** | ❌ | ❌ | ✅ Week 11 | ✅ |
| **Redis** | ❌ | ❌ | ❌ | ✅ Week 21 |
| **MinIO** | ❌ | ❌ | ❌ | ✅ Week 21 |
| **Kubernetes** | ❌ | ❌ | ❌ | ✅ Week 24+ |

---

## 🎯 **Заключение**

**Стек правильный. Технологии проверенные. Внедрение поэтапное.**

**Следующий шаг:** Начинаем Week 1 → создаём `AnimatedComponent` + `DefaultTheme` + Kafka-компоненты. 🚀



