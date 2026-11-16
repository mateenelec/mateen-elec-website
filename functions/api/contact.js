
export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();

    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const email = String(form.get("email") || "").trim();
    const type = String(form.get("type") || "").trim();
    const address = String(form.get("address") || "").trim();
    const details = String(form.get("details") || "").trim();

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
        { error: "Les informations sont trop longues." },
        { status: 400 }
      );
    }

    if (!env.RESEND_API_KEY) {
      return Response.json(
        { error: "Service de messagerie non configuré." },
        { status: 503 }
      );
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
      details
    ].join("\n");

    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "MATEEN ELEC <demandes@notify.mateenelec.fr>",
        to: ["mateenelec.51@gmail.com"],
        subject: "Nouvelle demande de devis - MATEEN ELEC",
        text: message,
        ...(email ? { reply_to: email } : {})
      })
    });

    if (!result.ok) {
      return Response.json(
        { error: "Impossible d'envoyer la demande." },
        { status: 502 }
      );
    }

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      { error: "Erreur lors de l'envoi." },
      { status: 500 }
    );
  }
}
