
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Guarda o actualiza la duda frecuente de un usuario
 * - Si ya existe (pregunta y contexto iguales para el usuario), suma a `times_asked`
 * - Si no, la crea
 */
export const useFrequentQuestions = () => {
  const { session } = useAuth();

  const registerQuestion = async (question: string, context?: string) => {
    if (!session) return;
    const userId = session.user.id;

    // Buscar si ya existe esa pregunta/contexto para el usuario
    const { data: existing, error: findError } = await supabase
      .from('frequent_questions')
      .select('id, times_asked')
      .eq('user_id', userId)
      .eq('question', question)
      .eq('context', context ?? null)
      .maybeSingle();

    if (findError) {
      console.error('Error buscando duda frecuente:', findError);
      return;
    }

    if (existing) {
      // Ya existe: incrementar contador
      await supabase
        .from('frequent_questions')
        .update({ times_asked: (existing.times_asked ?? 1) + 1 })
        .eq('id', existing.id);
    } else {
      // No existe: crearla
      await supabase.from('frequent_questions').insert([
        {
          user_id: userId,
          question,
          context: context || null,
          times_asked: 1,
        },
      ]);
    }
  };

  return { registerQuestion };
};
