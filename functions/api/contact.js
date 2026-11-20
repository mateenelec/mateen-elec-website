
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();

    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const email = String(form.get("email") || "").trim();
    const type = String(form.get("type") || "").trim();
    const address = String(form.get("address") || "").trim();
    const details = String(form.get("details") || "").trim();
    const submissionId = String(form.get("submissionId") || "").trim();

    if (!name || !phone || !details) {
      return Response.json(
        { error: "Veuillez remplir les champs obligatoires." },
        { status: 400 }
      );
    }

    if (
      [name, phone, email, type, address, details]
        .some(value => value.length > 5000)
    ) {
      return Response.json(
        { error: "Informations trop longues." },
        { status: 400 }
      );
    }

    if (!env.RESEND_API_KEY) {
      return Response.json(
        { error: "Messagerie non configurée." },
        { status: 503 }
      );
    }

    const attachments = [];
    const fileNames = [];

    if (submissionId) {
      if (
        !env.ATTACHMENTS ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)
      ) {
        return Response.json(
          { error: "Référence des fichiers invalide." },
          { status: 400 }
        );
      }

      const listed = await env.ATTACHMENTS.list({
        prefix: `demandes/${submissionId}/`,
        limit: 10
      });

      if (!listed.objects.length ||
          listed.objects.length > MAX_FILES) {
        return Response.json(
          { error: "Fichiers introuvables." },
          { status: 400 }
        );
      }

      let totalSize = 0;

      for (const item of listed.objects) {
        const object = await env.ATTACHMENTS.get(item.key);

        if (!object) {
          return Response.json(
            { error: "Fichier introuvable." },
            { status: 400 }
          );
        }

        const contentType = object.httpMetadata?.contentType;
        const extension = ALLOWED_TYPES[contentType];

        if (!extension || object.size > MAX_FILE_SIZE) {
          return Response.json(
            { error: "Fichier non autorisé." },
            { status: 400 }
          );
        }

        totalSize += object.size;

        if (totalSize > MAX_TOTAL_SIZE) {
          return Response.json(
            { error: "Pièces jointes trop volumineuses (25 Mo max)." },
            { status: 413 }
          );
        }

        const originalName =
          object.customMetadata?.originalName ||
          `document.${extension}`;

        const safeName = originalName
          .replace(/[^\p{L}\p{N}._ -]/gu, "_")
          .slice(0, 150);

        const bytes = new Uint8Array(
          await object.arrayBuffer()
        );

        let binary = "";

for (let i = 0; i < bytes.length; i += 8192) {
  binary += String.fromCharCode(
    ...bytes.subarray(i, i + 8192)
  );
}

const base64 = btoa(binary);
        attachments.push({
          filename: safeName,
          content: base64,
          content_type: contentType
        });

        fileNames.push(safeName);
      }
    }

    const message = [
      "Nouvelle demande de devis - MATEEN ELEC",
      "",
      "Nom : " + name,
      "Téléphone : " + phone,
      "E-mail : " + (email || "Non renseigné"),
      "Type de demande : " + (type || "Non renseigné"),
      "Adresse du chantier : " + (address || "Non renseignée"),
      "",
      "Description :",
      details,
      "",
      "Référence : " + (submissionId || "Sans pièces jointes"),
      "Fichiers : " + (
        fileNames.length ? fileNames.join(", ") : "Aucun"
      )
    ].join("\n");

    const result = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "MATEEN ELEC <demandes@notify.mateenelec.fr>",
          to: ["mateenelec.51@gmail.com"],
          subject: "Nouvelle demande de devis - MATEEN ELEC",
          text: message,
          ...(email ? { reply_to: email } : {}),
          ...(attachments.length ? { attachments } : {})
        })
      }
    );

    if (!result.ok) {
      console.error("Resend error:", result.status);
      return Response.json(
        { error: "Impossible d'envoyer la demande." },
        { status: 502 }
      );
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error("Contact error:", error);

    return Response.json(
      { error: "Erreur lors de l'envoi." },
      { status: 500 }
    );
  }
}
