
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ATTACHMENTS) {
      return Response.json(
        { error: "Stockage indisponible." },
        { status: 503 }
      );
    }

    const origin = new URL(request.url).origin;
    const requestOrigin = request.headers.get("Origin");

    if (requestOrigin !== origin) {
      return Response.json(
        { error: "Origine non autorisée." },
        { status: 403 }
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") || 0
    );

    if (contentLength > 52 * 1024 * 1024) {
      return Response.json(
        { error: "Taille totale trop importante." },
        { status: 413 }
      );
    }

    const form = await request.formData();
    const files = form.getAll("attachments");

    if (!files.length || files.length > MAX_FILES) {
      return Response.json(
        { error: "Sélectionnez entre 1 et 5 fichiers." },
        { status: 400 }
      );
    }

    const validated = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        return Response.json(
          { error: "Fichier invalide." },
          { status: 400 }
        );
      }

      const extension = ALLOWED_TYPES[file.type];

      if (!extension || file.size === 0 ||
          file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: "Format invalide ou fichier supérieur à 10 Mo." },
          { status: 400 }
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());

      const isJpeg = extension === "jpg" &&
        bytes[0] === 0xff && bytes[1] === 0xd8 &&
        bytes[2] === 0xff;

      const isPng = extension === "png" &&
        bytes.slice(0, 8).join(",") ===
        "137,80,78,71,13,10,26,10";

      const isWebp = extension === "webp" &&
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

      const isPdf = extension === "pdf" &&
        String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";

      if (!(isJpeg || isPng || isWebp || isPdf)) {
        return Response.json(
          { error: "Le contenu du fichier est invalide." },
          { status: 400 }
        );
      }

      validated.push({ file, bytes, extension });
    }

    const submissionId = crypto.randomUUID();
    const uploaded = [];

    for (const { file, bytes, extension } of validated) {
      const id = crypto.randomUUID();
      const key = `demandes/${submissionId}/${id}.${extension}`;

      await env.ATTACHMENTS.put(key, bytes, {
        httpMetadata: {
          contentType: file.type
        },
        customMetadata: {
          originalName: file.name.slice(0, 200)
        }
      });

      uploaded.push({
        name: file.name,
        key
      });
    }

    return Response.json({
      success: true,
      submissionId,
      files: uploaded
    });

  } catch (error) {
    console.error("Upload error:", error);

    return Response.json(
      { error: "Erreur lors de l'envoi des fichiers." },
      { status: 500 }
    );
  }
}
