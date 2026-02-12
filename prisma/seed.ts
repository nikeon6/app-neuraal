import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Seed script — creates test data for local development.
 * Uses userId "user-123" (matches NEXT_PUBLIC_DEV_USER_ID in .env).
 */

const USER_ID = "user-123";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding database...\n");

  // ---------------------------------------------------------------------------
  // 0. Ensure pgvector extension and embedding column exist
  //    (Prisma's driver adapter may skip vector columns during migrations)
  // ---------------------------------------------------------------------------
  const embeddingDim = process.env.EMBEDDING_DIM
    ? Number.parseInt(process.env.EMBEDDING_DIM, 10)
    : 4096; // default matches qwen3-embedding:latest (8b)
  console.log(`  📦 Ensuring pgvector extension and embedding column (dim=${embeddingDim})...`);
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
  await pool.query(
    `ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "embedding" vector(${embeddingDim});`
  );
  console.log("  ✅ pgvector ready\n");

  // ---------------------------------------------------------------------------
  // 1. Topics
  // ---------------------------------------------------------------------------
  const topicsData = [
    { name: "Trabajo", color: "#3B82F6" },       // blue
    { name: "Personal", color: "#10B981" },       // emerald
    { name: "Estudio", color: "#F59E0B" },        // amber
    { name: "Salud", color: "#EF4444" },          // red
    { name: "Proyectos", color: "#8B5CF6" },      // violet
  ];

  const topics: Array<{ id: string; name: string; color: string }> = [];

  for (const t of topicsData) {
    const topic = await prisma.topic.upsert({
      where: { userId_name: { userId: USER_ID, name: t.name } },
      update: {},
      create: { userId: USER_ID, name: t.name, color: t.color },
    });
    topics.push(topic);
    console.log(`  ✅ Topic: ${topic.name} (${topic.color})`);
  }

  // ---------------------------------------------------------------------------
  // 2. Entries (tasks + notes) spread across recent dates
  // ---------------------------------------------------------------------------
  const today = new Date();

  /** Helper: YYYY-MM-DD offset by `days` from today */
  function dateStr(offsetDays: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  const entriesData = [
    // Today
    {
      date: dateStr(0),
      type: "task",
      title: "Revisar PRs pendientes",
      content: { text: "Revisar los pull requests abiertos del equipo y dejar feedback." },
      topicId: topics[0].id, // Trabajo
      completed: false,
    },
    {
      date: dateStr(0),
      type: "task",
      title: "Hacer ejercicio",
      content: { text: "30 minutos de cardio + estiramientos." },
      topicId: topics[3].id, // Salud
      completed: true,
    },
    {
      date: dateStr(0),
      type: "note",
      title: "Ideas para el TFM",
      content: { text: "Explorar integración de IA para clasificación automática de temas usando embeddings de Ollama." },
      topicId: topics[2].id, // Estudio
      completed: null,
    },

    // Yesterday
    {
      date: dateStr(-1),
      type: "task",
      title: "Desplegar backend v2",
      content: { text: "Subir la nueva versión del backend con las migraciones de Prisma aplicadas." },
      topicId: topics[0].id, // Trabajo
      completed: true,
    },
    {
      date: dateStr(-1),
      type: "task",
      title: "Comprar ingredientes",
      content: { text: "Verduras, pollo y arroz para la semana." },
      topicId: topics[1].id, // Personal
      completed: true,
    },
    {
      date: dateStr(-1),
      type: "note",
      title: "Reunión equipo",
      content: { text: "Puntos tratados: roadmap Q1, asignación de tareas, demo el viernes." },
      topicId: topics[0].id, // Trabajo
      completed: null,
    },

    // 2 days ago
    {
      date: dateStr(-2),
      type: "task",
      title: "Estudiar Prisma v7",
      content: { text: "Leer la documentación de driver adapters y las novedades de Prisma 7." },
      topicId: topics[2].id, // Estudio
      completed: true,
    },
    {
      date: dateStr(-2),
      type: "task",
      title: "Configurar Docker",
      content: { text: "Crear docker-compose con PostgreSQL, Redis, n8n y Ollama." },
      topicId: topics[4].id, // Proyectos
      completed: true,
    },

    // 3 days ago
    {
      date: dateStr(-3),
      type: "task",
      title: "Implementar API topics",
      content: { text: "CRUD completo de topics con validaciones y tests." },
      topicId: topics[4].id, // Proyectos
      completed: true,
    },
    {
      date: dateStr(-3),
      type: "note",
      title: "Notas de lectura",
      content: { text: "Clean Architecture: separar dominio, aplicación e infraestructura. Dependency inversion es clave." },
      topicId: topics[2].id, // Estudio
      completed: null,
    },

    // Tomorrow
    {
      date: dateStr(1),
      type: "task",
      title: "Preparar presentación",
      content: { text: "Slides para la demo del viernes con el equipo." },
      topicId: topics[0].id, // Trabajo
      completed: false,
    },
    {
      date: dateStr(1),
      type: "task",
      title: "Ir al médico",
      content: { text: "Cita a las 10:30 — revisión anual." },
      topicId: topics[3].id, // Salud
      completed: false,
    },

    // 2 days from now
    {
      date: dateStr(2),
      type: "task",
      title: "Entregar informe TFM",
      content: { text: "Primer borrador del capítulo 3 — arquitectura del sistema." },
      topicId: topics[2].id, // Estudio
      completed: false,
    },
    {
      date: dateStr(2),
      type: "task",
      title: "Code review sprint",
      content: { text: "Revisar todas las PRs del sprint actual antes del cierre." },
      topicId: topics[0].id, // Trabajo
      completed: false,
    },
  ];

  let created = 0;
  for (const e of entriesData) {
    await prisma.entry.create({
      data: {
        userId: USER_ID,
        date: e.date,
        type: e.type,
        title: e.title,
        content: e.content,
        topicId: e.topicId,
        completed: e.completed,
      },
    });
    created++;
  }
  console.log(`\n  ✅ Created ${created} entries across ${new Set(entriesData.map((e) => e.date)).size} days\n`);

  // ---------------------------------------------------------------------------
  // Done
  // ---------------------------------------------------------------------------
  console.log("🌱 Seed completed!\n");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
