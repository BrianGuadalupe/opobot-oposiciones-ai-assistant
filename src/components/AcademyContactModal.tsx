
import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface AcademyContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialState = {
  academyName: "",
  studentCount: "",
  email: "",
  phone: "",
};

const AcademyContactModal: React.FC<AcademyContactModalProps> = ({ open, onOpenChange }) => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "/functions/v1"}/academy-contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!response.ok) throw new Error("No se pudo enviar el mensaje");
      toast({ title: "¡Enviado!", description: "Te contactaremos pronto por email o teléfono." });
      setForm(initialState);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No fue posible enviar el formulario", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-md w-full">
        <SheetHeader>
          <SheetTitle>Solicita información para academias</SheetTitle>
        </SheetHeader>
        <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
          <div>
            <label className="block mb-1 font-medium" htmlFor="academyName">
              Nombre de la academia
            </label>
            <Input
              id="academyName"
              name="academyName"
              value={form.academyName}
              onChange={onChange}
              placeholder="Academia Ejemplo"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium" htmlFor="studentCount">
              Nº de estudiantes
            </label>
            <Input
              id="studentCount"
              name="studentCount"
              value={form.studentCount}
              onChange={onChange}
              type="number"
              placeholder="Ej: 30"
              required
              min={1}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium" htmlFor="email">
              Email de contacto
            </label>
            <Input
              id="email"
              name="email"
              value={form.email}
              onChange={onChange}
              type="email"
              placeholder="ejemplo@email.com"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium" htmlFor="phone">
              Teléfono
            </label>
            <Input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={onChange}
              type="tel"
              placeholder="Número de teléfono"
              required
            />
          </div>
          <Button type="submit" className="w-full bg-opobot-blue hover:bg-opobot-blue-dark" disabled={loading}>
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </form>
        <SheetClose asChild>
          <button className="absolute top-4 right-4 text-2xl" aria-label="Cerrar">&times;</button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
};

export default AcademyContactModal;
