
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcademyContactRequest {
  academyName: string;
  studentCount: string;
  email: string;
  phone: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as AcademyContactRequest;

    const html = `
      <h2>Nuevo contacto de Academia</h2>
      <p><b>Nombre de la academia:</b> ${body.academyName}</p>
      <p><b>Estudiantes:</b> ${body.studentCount}</p>
      <p><b>Email:</b> ${body.email}</p>
      <p><b>Teléfono:</b> ${body.phone}</p>
    `;

    const emailResponse = await resend.emails.send({
      from: "Opobot Landing <onboarding@resend.dev>",
      to: ["opobot.info@gmail.com"],
      subject: "Solicitud de información (Academias) - Opobot",
      html,
      reply_to: body.email,
    });

    console.log("Academy contact sent:", emailResponse);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Academy Contact Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
