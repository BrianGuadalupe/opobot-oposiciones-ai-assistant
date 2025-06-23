
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcademyContactRequest {
  academyName: string;
  email: string;
  phone: string;
  studentCount: string;
  city: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as AcademyContactRequest;

    // Create Supabase client with service role key for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Save academy contact to database
    const { data: academyData, error: dbError } = await supabase
      .from('academy_contacts')
      .insert({
        academy_name: body.academyName,
        email: body.email,
        phone: body.phone,
        student_count: parseInt(body.studentCount),
        city: body.city,
        contacted: false
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Error al guardar los datos en la base de datos");
    }

    console.log("Academy contact saved to database:", academyData);

    // Send email notification
    const html = `
      <h2>Nueva solicitud de información - Plan Academias</h2>
      <p><b>Nombre de la academia:</b> ${body.academyName}</p>
      <p><b>Email:</b> ${body.email}</p>
      <p><b>Teléfono:</b> ${body.phone}</p>
      <p><b>Número de alumnos:</b> ${body.studentCount}</p>
      <p><b>Ciudad:</b> ${body.city}</p>
      <p><em>Un representante debe contactar a esta academia lo antes posible para mostrar las posibilidades de Opobot e iniciar la integración.</em></p>
      <p><em>ID del registro: ${academyData.id}</em></p>
    `;

    const emailResponse = await resend.emails.send({
      from: "Opobot Academias <onboarding@resend.dev>",
      to: ["opobot.info@gmail.com"],
      subject: "Nueva solicitud de información - Plan Academias",
      html,
      reply_to: body.email,
    });

    console.log("Academy contact email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      academy_id: academyData.id,
      email_id: emailResponse.id 
    }), {
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
