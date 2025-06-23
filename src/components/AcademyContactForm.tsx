
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface AcademyContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialState = {
  academyName: "",
  email: "",
  phone: "",
  studentCount: "",
  city: "",
};

const AcademyContactForm: React.FC<AcademyContactFormProps> = ({ open, onOpenChange }) => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch("https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/academy-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      if (!response.ok) throw new Error("No se pudo enviar el mensaje");
      
      toast({ 
        title: "¡Solicitud enviada!", 
        description: "Un representante de Opobot te contactará pronto para mostrar las posibilidades de integración." 
      });
      
      setForm(initialState);
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "No fue posible enviar el formulario", 
        variant: "destructive" 
      });
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full mx-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center text-gray-900">
            Solicitud para Academias
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </DialogHeader>
        
        <div className="mt-4">
          <p className="text-sm text-gray-600 text-center mb-6">
            Un representante de Opobot te contactará lo antes posible para mostrar las posibilidades 
            de integración y comenzar el proceso.
          </p>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-1 font-medium text-sm text-gray-700" htmlFor="academyName">
                Nombre de la academia *
              </label>
              <Input
                id="academyName"
                name="academyName"
                value={form.academyName}
                onChange={onChange}
                placeholder="Academia de Oposiciones Ejemplo"
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block mb-1 font-medium text-sm text-gray-700" htmlFor="email">
                Email de contacto *
              </label>
              <Input
                id="email"
                name="email"
                value={form.email}
                onChange={onChange}
                type="email"
                placeholder="contacto@academia.com"
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block mb-1 font-medium text-sm text-gray-700" htmlFor="phone">
                Teléfono *
              </label>
              <Input
                id="phone"
                name="phone"
                value={form.phone}
                onChange={onChange}
                type="tel"
                placeholder="600 123 456"
                required
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block mb-1 font-medium text-sm text-gray-700" htmlFor="studentCount">
                Número de alumnos *
              </label>
              <Input
                id="studentCount"
                name="studentCount"
                value={form.studentCount}
                onChange={onChange}
                type="number"
                placeholder="Ej: 50"
                required
                min={1}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block mb-1 font-medium text-sm text-gray-700" htmlFor="city">
                Ciudad *
              </label>
              <Input
                id="city"
                name="city"
                value={form.city}
                onChange={onChange}
                placeholder="Madrid"
                required
                className="w-full"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-opobot-blue hover:bg-opobot-blue-dark text-white font-medium py-2 px-4 rounded-lg transition-colors" 
              disabled={loading}
            >
              {loading ? "Enviando..." : "Solicitar Información"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AcademyContactForm;
