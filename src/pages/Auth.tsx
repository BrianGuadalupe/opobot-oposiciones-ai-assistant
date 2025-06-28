import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useDemoRegistration } from "@/hooks/useDemoRegistration";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(searchParams.get('mode') || 'login');
  const isDemo = searchParams.get('demo') === 'true';
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { registerDemo } = useDemoRegistration();
  const { subscribed, loading: subscriptionLoading } = useSubscription();
  const [showDemoBlocked, setShowDemoBlocked] = useState(false);
  const [demoQueriesRemaining, setDemoQueriesRemaining] = useState(3);
  const [selectedOposition, setSelectedOposition] = useState('');

  useEffect(() => {
    if (user && isDemo && subscribed && !subscriptionLoading) {
      setShowDemoBlocked(true);
    } else if (user) {
      if (isDemo) {
        // Si es demo y ya está logueado, activar demo directamente
        handleDemoActivation();
      } else {
        navigate("/");
      }
    }
  }, [user, navigate, isDemo, subscribed, subscriptionLoading]);

  const handleDemoActivation = async () => {
    const success = await registerDemo();
    if (success) {
      navigate('/chat');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden");
        }

        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }

        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName
            }
          }
        });

        if (error) throw error;

        toast({
          title: "Registro exitoso",
          description: isDemo ? 
            "Tu cuenta se ha creado. Activando demo..." : 
            "Revisa tu correo para confirmar tu cuenta.",
        });

        if (isDemo) {
          // Para demo, esperar un momento y luego activar
          setTimeout(async () => {
            await handleDemoActivation();
          }, 2000);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Inicio de sesión exitoso",
          description: "Bienvenido de vuelta",
        });

        if (isDemo) {
          await handleDemoActivation();
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDemoBlocked = () => {
    setShowDemoBlocked(false);
    navigate("/");
  };

  // Hook para tracking de demo
  const useDemoAnalytics = () => {
    const trackDemoEvent = async (event: string, data?: any) => {
      await supabase.functions.invoke('demo-analytics', {
        body: {
          event,
          userId: user?.id,
          timestamp: new Date().toISOString(),
          data
        }
      });
    };

    return { trackDemoEvent };
  };

  // Eventos a trackear:
  // - demo_started
  // - demo_query_sent
  // - demo_query_answered
  // - demo_conversion_attempt
  // - demo_expired

  const checkExistingDemo = async () => {
    const { data } = await supabase.functions.invoke('manage-usage', {
      body: { action: 'check_existing_demo' }
    });
    
    if (data.hasActiveDemo) {
      toast({
        title: "Demo Recuperado",
        description: `Tienes ${data.queriesRemaining} consultas restantes de tu demo`,
      });
      return true;
    }
    return false;
  };

  const DemoPreferences = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label>¿Qué oposición estás preparando?</Label>
          <Select value={selectedOposition} onValueChange={setSelectedOposition}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona tu oposición" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="administrativo">Administrativo</SelectItem>
              <SelectItem value="policia">Policía Nacional</SelectItem>
              <SelectItem value="guardia">Guardia Civil</SelectItem>
              <SelectItem value="bomberos">Bomberos</SelectItem>
              <SelectItem value="otras">Otras</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {selectedOposition && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              Perfecto! Te ayudaremos con preguntas específicas sobre {selectedOposition}
            </p>
          </div>
        )}
      </div>
    );
  };

  const DemoReferral = () => {
    const referralCode = generateReferralCode();
    
    return (
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
        <h3 className="font-semibold text-purple-800 mb-2">Invita a amigos</h3>
        <p className="text-sm text-purple-700 mb-3">
          Comparte tu código y ambos obtendrán beneficios
        </p>
        
        <div className="flex gap-2">
          <Input 
            value={referralCode} 
            readOnly 
            className="font-mono text-sm"
          />
          <Button 
            size="sm"
            onClick={() => navigator.clipboard.writeText(referralCode)}
          >
            Copiar
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-opobot-blue">
              {isDemo ? "Demo Gratuito" : "Opobot"}
            </CardTitle>
            <CardDescription>
              {isDemo ? 
                "Crea tu cuenta para probar 3 consultas gratis" : 
                "Accede a tu cuenta de Opobot"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDemo ? (
              // Formulario simplificado para demo
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Tu nombre completo"
                  />
                </div>
                <div className="relative">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Mínimo 6 caracteres"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirma tu contraseña"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">Consultas demo restantes:</span>
                    <span className="font-bold text-blue-900">{demoQueriesRemaining}/3</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(demoQueriesRemaining / 3) * 100}%` }}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creando cuenta..." : "🚀 Empezar Demo Gratis"}
                </Button>
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => navigate('/auth')}
                  >
                    ¿Ya tienes cuenta? Inicia sesión
                  </Button>
                </div>
              </form>
            ) : (
              // Formulario normal con tabs
              <Tabs value={mode} onValueChange={setMode}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="signup">Registrarse</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <Label htmlFor="email">Correo electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="tu@email.com"
                      />
                    </div>
                    <div className="relative">
                      <Label htmlFor="password">Contraseña</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="Tu contraseña"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <Label htmlFor="fullName">Nombre completo</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        placeholder="Tu nombre completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Correo electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="tu@email.com"
                      />
                    </div>
                    <div className="relative">
                      <Label htmlFor="password">Contraseña</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="Mínimo 6 caracteres"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          placeholder="Confirma tu contraseña"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Registrando..." : "Crear Cuenta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Modal de advertencia para demo bloqueada */}
      <Dialog open={showDemoBlocked} onOpenChange={handleCloseDemoBlocked}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-gray-900">
              Ya tienes acceso completo
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600">
              Tu cuenta ya tiene una suscripción activa con acceso ilimitado a Opobot. 
              No necesitas la demo gratuita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 space-y-3">
            <div className="bg-gradient-to-r from-opobot-blue/10 to-opobot-green/10 p-4 rounded-lg border border-opobot-blue/20">
              <h3 className="font-semibold text-opobot-blue mb-1">Tu suscripción incluye:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Consultas ilimitadas al chatbot</li>
                <li>• Acceso completo a todas las funciones</li>
                <li>• Soporte prioritario</li>
              </ul>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => navigate('/chat')}
                className="flex-1 bg-opobot-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opobot-blue-dark transition-colors"
              >
                Ir al Chat
              </button>
              <button
                onClick={handleCloseDemoBlocked}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Auth;
