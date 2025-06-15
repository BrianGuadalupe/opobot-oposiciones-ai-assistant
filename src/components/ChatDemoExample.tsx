
import { User, Bot } from "lucide-react";

const ChatDemoExample = () => {
  return (
    <section
      className="my-12 flex justify-center animate-fade-in"
      aria-label="Ejemplo visual del chat Opobot"
    >
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-lg p-0 overflow-hidden">
        <div className="bg-gray-900 flex items-center gap-2 px-4 py-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="ml-4 text-gray-400 text-xs">Demo interactivo</span>
        </div>
        <div className="p-5 space-y-3">
          {/* Mensaje usuario */}
          <div className="flex justify-end">
            <div className="max-w-[80%] bg-opobot-blue text-white px-4 py-2 rounded-2xl rounded-br-md shadow-sm flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-opobot-blue/80 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </span>
                <span className="text-xs text-gray-300 font-mono">09:37</span>
              </div>
              <span className="text-base leading-snug">
                ¿Cuánto tiempo de estudio recomiendas para aprobar Auxiliar Administrativo?
              </span>
            </div>
          </div>
          {/* Mensaje Opobot */}
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </span>
                <span className="text-xs text-gray-400 font-mono">09:37</span>
              </div>
              <span className="text-base leading-snug">
                Depende de tu base previa, pero la media recomendada es de 2 a 3 horas al día durante 10-12 meses.
                <br />
                <b className="font-semibold text-opobot-blue">¿Te ayudo a crear un plan personalizado?</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatDemoExample;
