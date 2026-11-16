
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, rating, comment, created_at FROM reviews ORDER BY id DESC LIMIT 100"
    ).all();

    const stats = await env.DB.prepare(
      "SELECT rating, COUNT(*) AS total FROM reviews GROUP BY rating"
    ).all();

    const counts = [0, 0, 0, 0, 0];
    for (const row of stats.results) {
      counts[Number(row.rating) - 1] = Number(row.total);
    }

    const total = counts.reduce((a, b) => a + b, 0);
    const average = total
      ? counts.reduce((sum, count, i) => sum + count * (i + 1), 0) / total
      : 0;

    return json({
      reviews: results,
      total,
      average: Number(average.toFixed(1)),
      counts
    });
  } catch (error) {
    console.error("Reviews GET error", error);
    return json({ error: "Erreur de chargement des avis." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json({ error: "Format invalide." }, 415);
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const rating = Number(body.rating);

    if (
      name.length < 2 || name.length > 80 ||
      comment.length < 5 || comment.length > 1000 ||
      !Number.isInteger(rating) || rating < 1 || rating > 5
    ) {
      return json({ error: "Veuillez vérifier votre avis." }, 400);
    }

    await env.DB.prepare(
      "INSERT INTO reviews (name, rating, comment) VALUES (?, ?, ?)"
    ).bind(name, rating, comment).run();

    return json({ success: true }, 201);
  } catch (error) {
    console.error("Reviews POST error", error);
    return json({ error: "Impossible d'enregistrer l'avis." }, 500);
  }
}
