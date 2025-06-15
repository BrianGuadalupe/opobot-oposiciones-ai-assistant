import { User, Bot } from "lucide-react";

const ChatDemoExample = () => {
  return (
    <section
      className="my-16 flex justify-center animate-fade-in"
      aria-label="Ejemplo visual del chat Opobot"
    >
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-3xl shadow-2xl p-0 overflow-hidden transition-all duration-500 hover:shadow-2xl">
        <div className="bg-gray-900 flex items-center gap-2 px-4 py-1.5 rounded-t-2xl">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="ml-4 text-gray-300 text-xs font-semibold tracking-wide">
            Opobot
          </span>
        </div>
        <div className="p-6 space-y-4 bg-gray-50">
          {/* Usuario pregunta */}
          <div className="flex justify-end">
            <div className="max-w-[80%] bg-opobot-blue text-white px-5 py-3 rounded-2xl rounded-br-md shadow flex flex-col items-end">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-opobot-blue/80 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </span>
                <span className="text-xs text-gray-200 font-mono">18:24</span>
              </div>
              <span className="text-base leading-snug font-medium">
                ¿Cuánto tiempo de estudio recomiendas para aprobar Auxiliar Administrativo?
              </span>
            </div>
          </div>
          {/* Opobot responde */}
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-2xl rounded-bl-md shadow flex flex-col items-start">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </span>
                <span className="text-xs text-gray-500 font-mono">18:24</span>
              </div>
              <span className="text-base leading-snug font-medium">
                Depende de tu base previa, pero la media recomendada es de 2-3 horas al día durante 10-12 meses.<br/>
                <span className="block mt-2 font-semibold text-opobot-blue">¿Te ayudo a crear un plan personalizado?</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatDemoExample;
